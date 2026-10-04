import React from 'react';
import { Star } from 'lucide-react';

export default function RecommendationCard({ shop }) {
  const {
    name,
    rating,
    distance,
    travelTime,
    queue,
    waitingTime,
    printingTime,
    completionTime,
  } = shop;

  return (
    <div className="card bg-teal-50 border border-teal-200">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-teal-800">Recommended for you</h3>
        <span className="recommendation-badge">BEST OPTION</span>
      </div>
      <div className="flex items-center space-x-1 mb-2">
        <Star size={16} className="text-yellow-400" />
        <span className="text-sm font-medium text-teal-800">{rating.toFixed(1)}</span>
      </div>
      <h4 className="text-xl font-bold text-teal-900 mb-2">{name}</h4>
      <div className="grid grid-cols-2 gap-2 text-sm text-teal-800 mb-3">
        <div><span className="font-medium">Distance:</span> {distance} km</div>
        <div><span className="font-medium">Travel:</span> {travelTime} min</div>
        <div><span className="font-medium">Queue:</span> {queue} jobs</div>
        <div><span className="font-medium">Waiting:</span> {waitingTime} min</div>
        <div><span className="font-medium">Printing:</span> {printingTime} min</div>
        <div className="col-span-2">
          <span className="font-medium">Est. Completion:</span>{' '}
          <span className="text-teal-600 font-semibold text-xl">{completionTime} min</span>
        </div>
      </div>
      <button className="btn btn-teal btn-sm w-full">View Details</button>
    </div>
  );
}
