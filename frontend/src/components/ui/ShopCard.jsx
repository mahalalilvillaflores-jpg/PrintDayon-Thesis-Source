import React from 'react';
import { Star } from 'lucide-react';

export default function ShopCard({ shop }) {
  const {
    name,
    rating,
    distance,
    travelTime,
    queue,
    waitingTime,
    printingTime,
    completionTime,
    isOpen,
    recommended,
  } = shop;

  const statusBadge = isOpen ? (
    <span className="badge badge-open">Open</span>
  ) : (
    <span className="badge badge-closed">Closed</span>
  );

  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-800">{name}</h3>
        <div className="flex items-center space-x-1">
          <Star size={16} className="text-yellow-400" />
          <span className="text-sm text-gray-600">{rating.toFixed(1)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 mb-3">
        <div><span className="font-medium">Distance:</span> {distance} km</div>
        <div><span className="font-medium">Travel:</span> {travelTime} min</div>
        <div><span className="font-medium">Queue:</span> {queue} jobs</div>
        <div><span className="font-medium">Waiting:</span> {waitingTime} min</div>
        <div><span className="font-medium">Printing:</span> {printingTime} min</div>
        <div className="col-span-2">
          <span className="font-medium">Est. Completion:</span>{' '}
          <span className="text-blue-600 font-semibold">{completionTime} min</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button className="btn btn-primary btn-sm">View Details</button>
        {statusBadge}
        {recommended && (
          <span className="recommendation-badge">BEST OPTION</span>
        )}
      </div>
    </div>
  );
}
