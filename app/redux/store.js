import { configureStore } from '@reduxjs/toolkit';
import mapReducer from './mapSlice';

export const store = configureStore({
  reducer: {
    map: mapReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export default store;
