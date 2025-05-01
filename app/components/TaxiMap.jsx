'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchDataForViewport, 
  setMapView, 
  setClusterDistance,
  addSelectedPoint,
  removeSelectedPoint,
  clearSelectedPoints
} from '../redux/mapSlice';

// OpenLayers imports
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Cluster from 'ol/source/Cluster';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import { getCenter } from 'ol/extent';
import { easeOut } from 'ol/easing';

// Import UI components only
import SidePanel from './map/SidePanel';
import DetailsModal from './map/DetailsModal';
import { generateCSV, calculateDistance } from './map/MapUtils';

export default function TaxiMap() {
  const mapRef = useRef();
  const olMapRef = useRef(null);
  const selectedFeaturesRef = useRef([]);
  const connectionLineRef = useRef(null);
  const connectionLayerRef = useRef(null);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [selectedPointDetails, setSelectedPointDetails] = useState(null);
  
  const dispatch = useDispatch();
  const { 
    taxiData, 
    loading, 
    clusterEnabled,
    clusterDistance,
    center,
    zoom,
    selectedPoints
  } = useSelector(state => state.map);

  // Initialize map
  useEffect(() => {
    if (!mapInitialized && mapRef.current) {
      const vectorSource = new VectorSource();
      
      // Create clustered source with dynamic distance
      const clusterSource = new Cluster({
        distance: clusterDistance,
        source: vectorSource,
        minDistance: 20
      });
      
      // Create vector layer with clustering
      const vectorLayer = new VectorLayer({
        source: clusterSource,
        style: (feature) => {
          const size = feature.get('features')?.length || 1;
          
          // Check if this is one of our selected features
          if (selectedFeaturesRef.current.includes(feature)) {
            // Get the index of this feature in our selected features
            const index = selectedFeaturesRef.current.indexOf(feature);
            // Use different colors for point 1 and point 2
            const color = index === 0 ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 0, 0.8)';
            
            return new Style({
              image: new CircleStyle({
                radius: 8,
                fill: new Fill({
                  color: color
                }),
                stroke: new Stroke({
                  color: 'white',
                  width: 2
                })
              })
            });
          }
          
          if (size === 1) {
            // Single point style
            return new Style({
              image: new CircleStyle({
                radius: 4,
                fill: new Fill({
                  color: 'rgba(24, 144, 255, 0.7)'
                }),
                stroke: new Stroke({
                  color: 'rgba(24, 144, 255, 1)',
                  width: 1
                })
              })
            });
          } else {
            // Cluster style - size affects the circle radius
            const radius = Math.min(25, 12 + Math.log(size) * 2);
            
            return new Style({
              image: new CircleStyle({
                radius: radius,
                fill: new Fill({
                  color: 'rgba(24, 144, 255, 0.7)'
                }),
                stroke: new Stroke({
                  color: 'white',
                  width: 2
                })
              }),
              text: new Text({
                text: size.toString(),
                fill: new Fill({
                  color: 'white'
                }),
                font: 'bold 12px sans-serif'
              })
            });
          }
        }
      });
      
      // Create a vector layer for the connection line
      const connectionSource = new VectorSource();
      const connectionLayer = new VectorLayer({
        source: connectionSource,
        style: new Style({
          stroke: new Stroke({
            color: 'rgba(255, 165, 0, 0.8)', // Orange line
            width: 3,
            lineDash: [10, 5] // Dashed line
          })
        }),
        zIndex: 100 // Make sure line appears above other features
      });
      
      connectionLayerRef.current = connectionLayer;
      
      // Initialize OpenLayers map
      olMapRef.current = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM()
          }),
          vectorLayer, // Vector layer for clustering and selection
          connectionLayer
        ],
        view: new View({
          center: fromLonLat(center),
          zoom: zoom,
          minZoom: 9,
          maxZoom: 18
        }),
        controls: defaultControls({
          zoom: true,
          rotate: false,
          attribution: true
        })
      });
      
      // Set up click handler for clusters and individual points
      olMapRef.current.on('click', (event) => {
        const feature = olMapRef.current.forEachFeatureAtPixel(
          event.pixel,
          (feature) => feature
        );
        
        if (feature) {
          // Get cluster features or the feature itself
          const features = feature.get('features');
          
          // If this is a cluster with multiple features
          if (features && features.length > 1) {
            // Clear any selections if clicking on a cluster
            selectedFeaturesRef.current = [];
            dispatch(clearSelectedPoints());
            
            // Clear the connection line
            updateConnectionLine();
            
            // Get the extent of features in the cluster
            const extent = features[0].getGeometry().getExtent().slice();
            
            features.forEach(feature => {
              const geometry = feature.getGeometry();
              if (geometry) {
                geometry.getExtent().forEach((value, index) => {
                  if (index < 2) {
                    extent[index] = Math.min(extent[index], value);
                  } else {
                    extent[index] = Math.max(extent[index], value);
                  }
                });
              }
            });
            
            // Get center of cluster
            const clusterCenter = getCenter(extent);
            
            // Current view
            const view = olMapRef.current.getView();
            
            // Calculate new zoom level (increase by 2 levels, but respect max zoom)
            const currentZoom = view.getZoom();
            const newZoom = Math.min(18, currentZoom + 2);
            
            // Animate to the cluster
            view.animate({
              center: clusterCenter,
              zoom: newZoom,
              duration: 500,
              easing: easeOut
            });
            
            // Adjust cluster distance for the new zoom level
            const newClusterDistance = Math.max(20, Math.min(80, 100 - (newZoom * 4)));
            dispatch(setClusterDistance(newClusterDistance));
            
            // Update map state in Redux and load data for the new viewport
            const newLonLat = toLonLat(clusterCenter);
            const newExtent = view.calculateExtent(olMapRef.current.getSize());
            
            dispatch(setMapView({ 
              center: newLonLat, 
              zoom: newZoom, 
              extent: newExtent 
            }));
            
            // Load data for the new area
            dispatch(fetchDataForViewport({ 
              extent: newExtent, 
              zoom: newZoom, 
              loadedChunks: [] 
            }));
          } 
          // This is a single point
          else if (features && features.length === 1) {
            // This is a single point within a cluster
            const singleFeature = features[0];
            const properties = singleFeature.get('properties');
            
            // If we already have 2 points selected and this is a new point
            if (selectedFeaturesRef.current.length >= 2 && !selectedFeaturesRef.current.includes(feature)) {
              // Remove the first point (oldest selection)
              selectedFeaturesRef.current.shift();
              dispatch(removeSelectedPoint(0));
            }
            
            // If this point is already selected, unselect it
            const existingIndex = selectedFeaturesRef.current.indexOf(feature);
            if (existingIndex >= 0) {
              selectedFeaturesRef.current.splice(existingIndex, 1);
              dispatch(removeSelectedPoint(existingIndex));
            } else {
              // Add the new point
              selectedFeaturesRef.current.push(feature);
              dispatch(addSelectedPoint(properties));
            }
            
            // Update the connection line
            updateConnectionLine();
            
            // Force a re-render of the vector layer to update styles
            const vectorLayer = olMapRef.current.getLayers().getArray()[1];
            vectorLayer.changed();
          }
        }
      });
      
      // Set up map event listeners for viewport changes
      olMapRef.current.on('moveend', () => {
        const view = olMapRef.current.getView();
        const center = toLonLat(view.getCenter());
        const zoom = view.getZoom();
        const extent = view.calculateExtent(olMapRef.current.getSize());
        
        // Update map state in Redux
        dispatch(setMapView({ center, zoom, extent }));
        
        // Adjust cluster distance based on zoom level
        const newClusterDistance = Math.max(20, Math.min(80, 100 - (zoom * 4)));
        dispatch(setClusterDistance(newClusterDistance));
        
        // Load data for new viewport (limit initial load to 3 chunks)
        const maxChunks = mapInitialized ? 5 : 3;
        
        dispatch(fetchDataForViewport({ 
          extent, 
          zoom, 
          loadedChunks: [],
          maxChunks
        }));
      });
      
      setMapInitialized(true);
      
      // Initial data load with limited chunks
      const view = olMapRef.current.getView();
      const extent = view.calculateExtent(olMapRef.current.getSize());
      
      dispatch(fetchDataForViewport({ 
        extent, 
        zoom, 
        loadedChunks: [],
        maxChunks: 3  // Limit initial load to just 3 chunks
      }));
    }
  }, [dispatch, mapInitialized, center, zoom, clusterEnabled, clusterDistance]);

  // Function to update the connection line between selected points
  const updateConnectionLine = () => {
    if (!olMapRef.current || !connectionLayerRef.current) return;
    
    const connectionSource = connectionLayerRef.current.getSource();
    connectionSource.clear();
    
    // If we have 2 selected features, create a line between them
    if (selectedFeaturesRef.current.length === 2) {
      // Get the coordinates of both selected features
      const feature1 = selectedFeaturesRef.current[0];
      const feature2 = selectedFeaturesRef.current[1];
      
      if (feature1 && feature2) {
        // Get the actual point features (they are inside clusters)
        const point1 = feature1.get('features')[0];
        const point2 = feature2.get('features')[0];
        
        if (point1 && point2) {
          // Get the geometries
          const geom1 = point1.getGeometry();
          const geom2 = point2.getGeometry();
          
          if (geom1 && geom2) {
            // Create a line between the two points
            const lineFeature = new Feature({
              geometry: new LineString([
                geom1.getCoordinates(),
                geom2.getCoordinates()
              ])
            });
            
            // Add the line to the connection layer
            connectionSource.addFeature(lineFeature);
            connectionLineRef.current = lineFeature;
          }
        }
      }
    } else {
      // Remove the line if we don't have exactly 2 points
      connectionLineRef.current = null;
    }
  };

  // Update map with new taxi data when it changes
  useEffect(() => {
    if (mapInitialized && olMapRef.current && taxiData.length > 0) {
      // Get the vector layer and its source
      const vectorLayer = olMapRef.current.getLayers().getArray()[1];
      const clusterSource = vectorLayer.getSource();
      
      // Get the underlying vector source
      const vectorSource = clusterSource.getSource();
      vectorSource.clear();
      
      // Save the currently selected points coordinates for later matching
      const selectedCoordinates = selectedPoints.map(point => [
        point.pickup_longitude, 
        point.pickup_latitude
      ]);
      
      // Clear selected features array but keep the reference
      selectedFeaturesRef.current = [];
      
      // Get current view state
      const view = olMapRef.current.getView();
      const zoom = view.getZoom();
      const extent = view.calculateExtent(olMapRef.current.getSize());
      
      // Implement adaptive sampling based on zoom level and dataset size
      let samplingRate = 1; // Default: use all points
      
      if (taxiData.length > 50000) {
        // For extremely large datasets, use more aggressive sampling at lower zoom levels
        if (zoom < 12) {
          samplingRate = Math.ceil(taxiData.length / 10000); // Very aggressive sampling
        } else if (zoom < 14) {
          samplingRate = Math.ceil(taxiData.length / 20000); // Moderate sampling
        } else {
          samplingRate = Math.ceil(taxiData.length / 30000); // Less sampling at higher zoom
        }
      } else if (taxiData.length > 20000) {
        // For large datasets
        if (zoom < 13) {
          samplingRate = Math.ceil(taxiData.length / 15000);
        } else {
          samplingRate = Math.ceil(taxiData.length / 20000);
        }
      }
      
      console.log(`Zoom: ${zoom}, Points: ${taxiData.length}, Sampling: 1/${samplingRate}`);
      
      // Filter and create features with sampling
      const filteredData = samplingRate > 1 
        ? taxiData.filter((_, index) => index % samplingRate === 0)
        : taxiData;
        
      const features = filteredData
        .filter(point => 
          point.pickup_longitude && 
          point.pickup_latitude && 
          !isNaN(point.pickup_longitude) && 
          !isNaN(point.pickup_latitude))
        .map(point => {
          const feature = new Feature({
            geometry: new Point(fromLonLat([point.pickup_longitude, point.pickup_latitude])),
            properties: point
          });
          return feature;
        });
      
      // Add features to the vector source
      vectorSource.addFeatures(features);
      
      // Adjust cluster distance dynamically based on zoom and data density
      const pointDensity = features.length / (extent[2] - extent[0]) / (extent[3] - extent[1]);
      const newClusterDistance = Math.max(
        20, 
        Math.min(
          100, 
          Math.round(50 * Math.pow(2, 14 - zoom) * Math.log10(pointDensity + 1))
        )
      );
      
      // Update cluster distance if it's significantly different
      if (Math.abs(newClusterDistance - clusterDistance) > 5) {
        dispatch(setClusterDistance(newClusterDistance));
      }
      
      // If we have selected points in the Redux store, find their corresponding features
      if (selectedPoints.length > 0 && selectedCoordinates.length > 0) {
        // Wait for the cluster source to update
        setTimeout(() => {
          try {
            // Look for clusters that contain our selected points
            const allClusters = clusterSource.getFeatures();
            
            allClusters.forEach(cluster => {
              const clusterFeatures = cluster.get('features') || [];
              
              clusterFeatures.forEach(feature => {
                const geom = feature.getGeometry();
                if (!geom) return;
                
                const coords = toLonLat(geom.getCoordinates());
                
                // Check if this feature matches any of our selected points
                selectedCoordinates.forEach((selectedCoord, index) => {
                  // Allow for small floating point differences
                  const isLongMatch = Math.abs(coords[0] - selectedCoord[0]) < 0.0000001;
                  const isLatMatch = Math.abs(coords[1] - selectedCoord[1]) < 0.0000001;
                  
                  if (isLongMatch && isLatMatch) {
                    // This is one of our selected points, add the cluster to our selected features
                    // using the correct index position
                    if (index < 2 && !selectedFeaturesRef.current.includes(cluster)) {
                      selectedFeaturesRef.current[index] = cluster;
                    }
                  }
                });
              });
            });
            
            console.log("Selected features found:", selectedFeaturesRef.current.length);
            
            // Force a redraw to show our highlighted points
            vectorLayer.changed();
            
            // Update the connection line if we have 2 points
            if (selectedFeaturesRef.current.length === 2) {
              updateConnectionLine();
            } else if (connectionLayerRef.current) {
              connectionLayerRef.current.getSource().clear();
            }
          } catch (error) {
            console.error("Error in update selection:", error);
          }
        }, 300); // Longer delay to ensure clustering is complete
      } else {
        // Clear the connection line if we don't have selected points
        if (connectionLayerRef.current) {
          connectionLayerRef.current.getSource().clear();
          connectionLineRef.current = null;
        }
      }
    }
  }, [taxiData, mapInitialized, selectedPoints]);

  // Update clustering when zoom level changes
  useEffect(() => {
    if (mapInitialized && olMapRef.current) {
      const vectorLayer = olMapRef.current.getLayers().getArray()[1];
      const source = vectorLayer.getSource();
      
      if (source) {
        source.setDistance(clusterDistance);
      }
    }
  }, [clusterDistance, mapInitialized]);

  // Update connection line when selected points change
  useEffect(() => {
    if (mapInitialized && selectedPoints.length === 2) {
      updateConnectionLine();
    } else if (mapInitialized && connectionLayerRef.current) {
      connectionLayerRef.current.getSource().clear();
    }
  }, [selectedPoints, mapInitialized]);
  
  // Handle clear all points
  const handleClearPoints = () => {
    dispatch(clearSelectedPoints());
    selectedFeaturesRef.current = [];
    
    // Clear the connection line
    if (connectionLayerRef.current) {
      connectionLayerRef.current.getSource().clear();
      connectionLineRef.current = null;
    }
    
    // Force redraw
    if (olMapRef.current) {
      const vectorLayer = olMapRef.current.getLayers().getArray()[1];
      vectorLayer.changed();
    }
  };
  
  // Handle view details
  const handleViewDetails = (point, index) => {
    setSelectedPointDetails({ point, index });
  };
  
  // Handle close details
  const handleCloseDetails = () => {
    setSelectedPointDetails(null);
  };
  
  // Handle CSV download
  const handleDownloadCSV = () => {
    const csv = generateCSV(selectedPoints);
    if (!csv) return;
    
    // Create a blob with the CSV data
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Create a link element and trigger download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'selected_taxi_points.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-gray-800 text-white p-4">
        <h1 className="text-xl font-bold">NYC Taxi Trip Map</h1>
        <p className="text-sm text-gray-300 mt-1">Click on clusters to zoom in and explore</p>
      </div>
      <div className="flex flex-grow">
        <div ref={mapRef} className="flex-grow" style={{ width: 'calc(100% - 320px)' }} />
        
        {/* Side panel */}
        <SidePanel 
          selectedPoints={selectedPoints}
          onClearPoints={handleClearPoints}
          onViewDetails={handleViewDetails}
          onDownloadCSV={handleDownloadCSV}
        />
      </div>
      
      {/* Details Modal */}
      <DetailsModal 
        pointDetails={selectedPointDetails}
        onClose={handleCloseDetails}
      />
    </div>
  );
}
