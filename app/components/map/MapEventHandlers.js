import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import { createConnectionLine, animateToCluster, calculateClusterDistance } from './MapUtils';

// Handle map click events
export function setupMapClickHandler(map, clusterSource, selectedFeaturesRef, connectionLayerRef, dispatch, actions) {
  const { addSelectedPoint, removeSelectedPoint, clearSelectedPoints, setClusterDistance, setMapView, fetchDataForViewport } = actions;
  
  map.on('click', (event) => {
    const feature = map.forEachFeatureAtPixel(
      event.pixel,
      (feature) => feature
    );
    
    if (!feature) return;
    
    // Get cluster features or the feature itself
    const features = feature.get('features');
    
    // If this is a cluster with multiple features
    if (features && features.length > 1) {
      // Clear any selections if clicking on a cluster
      selectedFeaturesRef.current = [];
      dispatch(clearSelectedPoints());
      
      // Update the connection line
      updateConnectionLine(connectionLayerRef, selectedFeaturesRef);
      
      // Handle zooming to cluster
      handleClusterZoom(map, feature, dispatch, actions);
    } 
    // This is a single point
    else if (features && features.length === 1) {
      // Handle single point selection
      handlePointSelection(feature, selectedFeaturesRef, connectionLayerRef, dispatch, addSelectedPoint, removeSelectedPoint);
      
      // Force a re-render of the vector layer to update styles
      const vectorLayer = map.getLayers().getArray()[1];
      if (vectorLayer) {
        vectorLayer.changed();
      }
    }
  });
}

// Handle selection of individual points
function handlePointSelection(feature, selectedFeaturesRef, connectionLayerRef, dispatch, addSelectedPoint, removeSelectedPoint) {
  const singleFeature = feature.get('features')[0];
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
  updateConnectionLine(connectionLayerRef, selectedFeaturesRef);
  
  // Force a re-render of the vector layer to update styles
  const vectorLayer = selectedFeaturesRef.current?.[0]?.layer;
  if (vectorLayer) {
    vectorLayer.changed();
  }
}

// Handle zooming when a cluster is clicked
function handleClusterZoom(map, feature, dispatch, actions) {
  const { setClusterDistance, setMapView, fetchDataForViewport } = actions;
  
  // Get the view
  const view = map.getView();
  const currentZoom = view.getZoom();
  
  // Animate to the cluster
  const newViewState = animateToCluster(map, view, feature, currentZoom);
  
  // Adjust cluster distance for the new zoom level
  const newClusterDistance = calculateClusterDistance(newViewState.zoom);
  dispatch(setClusterDistance(newClusterDistance));
  
  // Update map state in Redux and load data for the new viewport
  dispatch(setMapView(newViewState));
  
  // Load data for the new area
  dispatch(fetchDataForViewport({ 
    extent: newViewState.extent, 
    zoom: newViewState.zoom, 
    loadedChunks: [] 
  }));
}

// Set up event handlers for map viewport changes
export function setupViewportChangeHandler(map, dispatch, actions, mapInitialized) {
  const { setMapView, setClusterDistance, fetchDataForViewport } = actions;
  
  map.on('moveend', () => {
    const view = map.getView();
    const center = toLonLat(view.getCenter());
    const zoom = view.getZoom();
    const extent = view.calculateExtent(map.getSize());
    
    // Update map state in Redux
    dispatch(setMapView({ center, zoom, extent }));
    
    // Adjust cluster distance based on zoom level
    const newClusterDistance = calculateClusterDistance(zoom);
    dispatch(setClusterDistance(newClusterDistance));
    
    // Load data for new viewport (limit initial load to fewer chunks)
    const maxChunks = mapInitialized ? 5 : 3;
    
    dispatch(fetchDataForViewport({ 
      extent, 
      zoom, 
      loadedChunks: [],
      maxChunks
    }));
  });
}

// Update the connection line between selected points
export function updateConnectionLine(connectionLayerRef, selectedFeaturesRef) {
  if (!connectionLayerRef?.current) return;
  
  const connectionSource = connectionLayerRef.current.getSource();
  if (!connectionSource) return;
  
  connectionSource.clear();
  
  // If we have 2 selected features, create a line between them
  if (selectedFeaturesRef.current.length === 2) {
    const lineFeature = createConnectionLine(
      selectedFeaturesRef.current[0], 
      selectedFeaturesRef.current[1]
    );
    
    if (lineFeature) {
      connectionSource.addFeature(lineFeature);
    }
  }
}

// Process data points and update the map
export function updateMapData(vectorSource, taxiData, selectedPoints, selectedFeaturesRef, clusterSource, connectionLayerRef, vectorLayer) {
  // Clear current features
  vectorSource.clear();
  
  // Save the currently selected points coordinates for later matching
  const selectedCoordinates = selectedPoints.map(point => [
    point.pickup_longitude, 
    point.pickup_latitude
  ]);
  
  // Clear selected features array but keep the reference
  selectedFeaturesRef.current = [];
  
  // Add features for each taxi data point
  const features = taxiData
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
  
  // Only add a sample of features if there are too many (improves performance)
  if (features.length > 20000) {
    // Take a random sample of 20,000 features
    const sampledFeatures = [];
    const totalFeatures = features.length;
    const sampleRate = totalFeatures / 20000;
    
    for (let i = 0; i < totalFeatures; i += sampleRate) {
      sampledFeatures.push(features[Math.floor(i)]);
    }
    
    vectorSource.addFeatures(sampledFeatures);
  } else {
    vectorSource.addFeatures(features);
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
        if (vectorLayer) {
          vectorLayer.changed();
        }
        
        // Update the connection line if we have 2 points
        if (selectedFeaturesRef.current.length === 2) {
          updateConnectionLine(connectionLayerRef, selectedFeaturesRef);
        } else if (connectionLayerRef?.current) {
          connectionLayerRef.current.getSource().clear();
        }
      } catch (error) {
        console.error("Error in update selection:", error);
      }
    }, 300); // Slightly longer delay to ensure clustering is complete
  } else {
    // Clear the connection line if we don't have selected points
    if (connectionLayerRef?.current) {
      connectionLayerRef.current.getSource().clear();
    }
  }
}
