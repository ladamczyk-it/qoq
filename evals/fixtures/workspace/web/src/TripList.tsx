import { useEffect, useState } from 'react';

import { fetchTrips, type ITrip } from './api/trips';

export const TripList = (): React.JSX.Element => {
  const [trips, setTrips] = useState<ITrip[]>([]);

  useEffect(() => {
    fetchTrips().then(setTrips, () => setTrips([]));
  }, []);

  return (
    <ul>
      {trips.map((trip) => (
        <li key={trip.id}>
          {trip.name} <time dateTime={trip.startsOn}>{trip.startsOn}</time>
        </li>
      ))}
    </ul>
  );
};
