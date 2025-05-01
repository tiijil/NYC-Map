import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import Cluster from 'ol/source/Cluster';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import { createConnectionLineStyle } from './MapStyles';

export function initializeMap(target, center, zoom, selectedFeatures) {
  // Create vector source for taxi points
  const vectorSource = new VectorSource();
  
  // Create clustered source
  const clusterSource = new Cluster({
    distance: 50, // Will be adjusted dynamically later
    source: vectorSource,
    minDistance: 20
  });
  
  // Style function that references the current selectedFeatures
  const styleFunction = (feature) => {
    const size = feature.get('features')?.length || 1;
    
    // Check if this is one of our selected features
    if (selectedFeatures.includes(feature)) {
      // Get the index of this feature in our selected features
      const index = selectedFeatures.indexOf(feature);
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
  };
  
  // Create vector layer with clustering
  const vectorLayer = new VectorLayer({
    source: clusterSource,
    style: feature => styleFunction(feature)
  });
  
  // Create a vector layer for the connection line
  const connectionSource = new VectorSource();
  const connectionLayer = new VectorLayer({
    source: connectionSource,
    style: createConnectionLineStyle(),
    zIndex: 100 // Make sure line appears above other features
  });
  
  // Initialize OpenLayers map
  const map = new Map({
    target: target,
    layers: [
      new TileLayer({
        source: new OSM()
      }),
      vectorLayer,
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
  
  // Add a reference to the layer on each feature for easier access
  vectorLayer.on('change', function() {
    const features = clusterSource.getFeatures();
    features.forEach(feature => {
      feature.layer = vectorLayer;
    });
  });
  
  return {
    map,
    vectorLayer,
    connectionLayer,
    clusterSource,
    vectorSource,
    connectionSource
  };
}
