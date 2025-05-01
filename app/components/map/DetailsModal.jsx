'use client';

import { formatDateTime } from './MapUtils';

// DataItem component
function DataItem({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

export default function DetailsModal({ pointDetails, onClose }) {
  if (!pointDetails) return null;
  
  const { point, index } = pointDetails;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className={`px-6 py-4 ${index === 0 ? 'bg-red-100' : 'bg-green-100'}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">
              Point No {index + 1} - Full Details
            </h3>
            <button 
              onClick={onClose}
              className="text-gray-600 hover:text-gray-800"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
              </svg>
            </button>
          </div>
        </div>
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-3">
            <DataItem label="Pickup Date & Time" value={formatDateTime(point.tpep_pickup_datetime)} />
            <DataItem label="Dropoff Date & Time" value={formatDateTime(point.tpep_dropoff_datetime)} />
            <DataItem label="Passenger Count" value={point.passenger_count} />
            <DataItem label="Trip Distance" value={`${point.trip_distance} miles`} />
            
            <div className="pt-2 border-t border-gray-200">
              <h4 className="font-bold mb-2">Pickup Location</h4>
              <DataItem label="Latitude" value={point.pickup_latitude} />
              <DataItem label="Longitude" value={point.pickup_longitude} />
            </div>
            
            <div className="pt-2 border-t border-gray-200">
              <h4 className="font-bold mb-2">Dropoff Location</h4>
              <DataItem label="Latitude" value={point.dropoff_latitude} />
              <DataItem label="Longitude" value={point.dropoff_longitude} />
            </div>
            
            <div className="pt-2 border-t border-gray-200">
              <h4 className="font-bold mb-2">Payment Details</h4>
              <DataItem label="Fare Amount" value={`$${point.fare_amount}`} />
              <DataItem label="Tip Amount" value={`$${point.tip_amount}`} />
              <DataItem label="Total Amount" value={`$${point.total_amount}`} />
              <DataItem label="Payment Type" value={point.payment_type} />
            </div>
            
            <div className="pt-2 border-t border-gray-200">
              <h4 className="font-bold mb-2">Other Details</h4>
              <DataItem label="Rate Code" value={point.RatecodeID} />
              <DataItem label="Store & Forward Flag" value={point.store_and_fwd_flag} />
              <DataItem label="Vendor ID" value={point.VendorID} />
            </div>
          </div>
        </div>
        <div className="px-6 py-3 bg-gray-50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
