'use client';

import { calculateDistance } from './MapUtils';

export default function SidePanel({ selectedPoints, onClearPoints, onViewDetails, onDownloadCSV }) {
  return (
    <div className="w-80 bg-white shadow-lg overflow-y-auto border-l border-gray-200">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Selected Points</h2>
          {selectedPoints.length > 0 && (
            <button
              onClick={onClearPoints}
              className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              Clear All
            </button>
          )}
        </div>
        
        {selectedPoints.length > 0 ? (
          <div className="space-y-4">
            {selectedPoints.map((point, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-md ${index === 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}
              >
                <h3 className="font-medium mb-2">Point No {index + 1}</h3>
                <p className="mb-1">
                  <span className="font-bold">Latitude:</span> {point.pickup_latitude}
                </p>
                <p className="mb-3">
                  <span className="font-bold">Longitude:</span> {point.pickup_longitude}
                </p>
                <button 
                  onClick={() => onViewDetails(point, index)} 
                  className="mt-1 text-sm px-2 py-1 bg-blue-100 rounded hover:bg-blue-200 text-blue-700"
                >
                  View Full Details
                </button>
              </div>
            ))}
            
            {/* Distance information when two points are selected */}
            {selectedPoints.length === 2 && (
              <div className="p-4 rounded-md bg-orange-50 border border-orange-200">
                <h3 className="font-medium mb-2">Connection</h3>
                <p className="mb-1">
                  <span className="font-bold">Distance:</span> {calculateDistance(
                    selectedPoints[0].pickup_latitude,
                    selectedPoints[0].pickup_longitude,
                    selectedPoints[1].pickup_latitude,
                    selectedPoints[1].pickup_longitude
                  ).toFixed(2)} km
                </p>
              </div>
            )}
            
            {/* Download CSV button at the bottom of panel */}
            <div className="mt-6 text-center">
              <button
                onClick={onDownloadCSV}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 w-full"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  Download Selected Points as CSV
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center p-6 bg-gray-50 rounded-md">
            <p>Click on up to two data points to view their coordinates</p>
          </div>
        )}
      </div>
    </div>
  );
}
