import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';

// Style for regular points
export const createPointStyle = () => {
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
};

// Style for selected points
export const createSelectedPointStyle = (index) => {
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
};

// Style for clusters
export const createClusterStyle = (size) => {
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
};

// Style for connection line
export const createConnectionLineStyle = () => {
  return new Style({
    stroke: new Stroke({
      color: 'rgba(255, 165, 0, 0.8)', // Orange line
      width: 3,
      lineDash: [10, 5] // Dashed line
    })
  });
};

// Determine the appropriate style based on feature type
export const styleFunction = (feature, selectedFeatures) => {
  const size = feature.get('features')?.length || 1;
  
  // Check if this is one of our selected features
  if (selectedFeatures.includes(feature)) {
    // Get the index of this feature in our selected features
    const index = selectedFeatures.indexOf(feature);
    return createSelectedPointStyle(index);
  }
  
  if (size === 1) {
    // Single point style
    return createPointStyle();
  } else {
    // Cluster style
    return createClusterStyle(size);
  }
};
