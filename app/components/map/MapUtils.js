import LineString from 'ol/geom/LineString';
import Feature from 'ol/Feature';
import { fromLonLat, toLonLat } from 'ol/proj';
import { easeOut } from 'ol/easing';
import { getCenter } from 'ol/extent';

// Calculate distance between two points (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
};

export const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

// Format timestamp for display
export const formatDateTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString();
};

// Create a connection line between two points
export const createConnectionLine = (feature1, feature2) => {
  if (!feature1 || !feature2) return null;
  
  // Get the actual point features (they are inside clusters)
  const point1 = feature1.get('features')[0];
  const point2 = feature2.get('features')[0];
  
  if (!point1 || !point2) return null;
  
  // Get the geometries
  const geom1 = point1.getGeometry();
  const geom2 = point2.getGeometry();
  
  if (!geom1 || !geom2) return null;
  
  // Create a line between the two points
  return new Feature({
    geometry: new LineString([
      geom1.getCoordinates(),
      geom2.getCoordinates()
    ])
  });
};

// Generate CSV data for selected points
export const generateCSV = (selectedPoints) => {
  if (!selectedPoints || selectedPoints.length === 0) return null;
  
  // CSV header
  let csv = 'Point No,Latitude,Longitude,Pickup DateTime,Dropoff DateTime\n';
  
  // Add data for each selected point
  selectedPoints.forEach((point, index) => {
    csv += `${index + 1},`;
    csv += `${point.pickup_latitude},`;
    csv += `${point.pickup_longitude},`;
    csv += `${point.tpep_pickup_datetime || 'N/A'},`;
    csv += `${point.tpep_dropoff_datetime || 'N/A'}\n`;
  });
  
  return csv;
};

// Animate to a cluster center
export const animateToCluster = (map, view, cluster, currentZoom) => {
  if (!map || !view || !cluster) return;
  
  const features = cluster.get('features');
  if (!features || features.length <= 0) return;
  
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
  
  // Calculate new zoom level (increase by 2 levels, but respect max zoom)
  const newZoom = Math.min(18, currentZoom + 2);
  
  // Animate to the cluster
  view.animate({
    center: clusterCenter,
    zoom: newZoom,
    duration: 500,
    easing: easeOut
  });
  
  return {
    center: toLonLat(clusterCenter),
    zoom: newZoom,
    extent: view.calculateExtent(map.getSize())
  };
};

// Calculate the optimal cluster distance based on zoom level
export const calculateClusterDistance = (zoom) => {
  return Math.max(20, Math.min(80, 100 - (zoom * 4)));
};
