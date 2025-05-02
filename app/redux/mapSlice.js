import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunk to fetch a chunk of taxi data
export const fetchTaxiDataChunk = createAsyncThunk(
  'map/fetchTaxiDataChunk',
  async (chunkIndex) => {
    try {
      const paddedIndex = String(chunkIndex).padStart(5, '0');
      // Updated URL to fetch from GitHub Pages instead of local files
      const response = await fetch(`https://tiijil.github.io/nyc-map-data/data/chunks/chunk-${paddedIndex}.json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch chunk ${chunkIndex}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching taxi data chunk:", error);
      throw error;
    }
  }
);

// Fetch taxi data for current viewport
export const fetchDataForViewport = createAsyncThunk(
  'map/fetchDataForViewport',
  async ({ extent, zoom, loadedChunks, maxChunks = 5 }, { dispatch }) => {
    try {
      // For simplicity, we're loading chunks progressively
      // Start with a limited number of chunks based on maxChunks parameter
      const startChunk = 0;
      const endChunk = Math.min(maxChunks, 1275);
      
      const chunksToLoad = [];
      for (let i = startChunk; i < endChunk; i++) {
        chunksToLoad.push(i);
      }
      
      // Load chunks in parallel
      const promises = chunksToLoad.map(chunkIndex => 
        dispatch(fetchTaxiDataChunk(chunkIndex))
      );
      
      await Promise.all(promises);
      
      return chunksToLoad;
    } catch (error) {
      console.error("Error fetching data for viewport:", error);
      throw error;
    }
  }
);

const initialState = {
  taxiData: [],
  loadedChunks: [],
  loading: false,
  error: null,
  totalChunks: 1275,
  viewportExtent: null,
  clusterEnabled: true,
  clusterDistance: 60,
  center: [-73.9712, 40.7831], // Default center on NYC
  zoom: 12,
  selectedPoints: [], // Array to store selected points (max 2)
};

const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    setClusterEnabled: (state, action) => {
      state.clusterEnabled = action.payload;
    },
    setClusterDistance: (state, action) => {
      state.clusterDistance = action.payload;
    },
    setMapView: (state, action) => {
      const { center, zoom, extent } = action.payload;
      if (center) state.center = center;
      if (zoom !== undefined) state.zoom = zoom;
      if (extent) state.viewportExtent = extent;
    },
    addSelectedPoint: (state, action) => {
      // Only allow up to 2 points
      if (state.selectedPoints.length < 2) {
        state.selectedPoints.push(action.payload);
      }
    },
    removeSelectedPoint: (state, action) => {
      // Remove a specific point by index
      const index = action.payload;
      if (index >= 0 && index < state.selectedPoints.length) {
        state.selectedPoints.splice(index, 1);
      }
    },
    clearSelectedPoints: (state) => {
      state.selectedPoints = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTaxiDataChunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTaxiDataChunk.fulfilled, (state, action) => {
        // Filter out any points that don't have valid coordinates
        const validPoints = action.payload.filter(
          point => 
            point.pickup_longitude && point.pickup_latitude && 
            !isNaN(point.pickup_longitude) && !isNaN(point.pickup_latitude) &&
            point.pickup_longitude !== 0 && point.pickup_latitude !== 0
        );
        
        // Performance optimization: If we already have too many points,
        // limit how many new ones we add from each chunk
        let pointsToAdd = validPoints;
        
        if (state.taxiData.length > 30000) {
          // Take a sample of points when we already have a lot
          const sampleSize = Math.min(1000, Math.floor(validPoints.length / 5));
          pointsToAdd = [];
          
          for (let i = 0; i < sampleSize; i++) {
            const randomIndex = Math.floor(Math.random() * validPoints.length);
            pointsToAdd.push(validPoints[randomIndex]);
          }
        }
        
        // Add the new points to our dataset
        state.taxiData = [...state.taxiData, ...pointsToAdd];
        state.loading = false;
      })
      .addCase(fetchTaxiDataChunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(fetchDataForViewport.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDataForViewport.fulfilled, (state, action) => {
        state.loading = false;
      })
      .addCase(fetchDataForViewport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const { 
  setClusterEnabled, 
  setClusterDistance, 
  setMapView,
  addSelectedPoint,
  removeSelectedPoint,
  clearSelectedPoints
} = mapSlice.actions;

export default mapSlice.reducer;
