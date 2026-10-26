// Mirrors trips-api's ITrip. Hand-kept: nothing generates it from the server.
export interface ITrip {
  id: string;
  name: string;
  startsOn: string;
}

// Same origin: whatever serves the app forwards /trips to trips-api.
const BASE = '';

export const fetchTrips = async (): Promise<ITrip[]> => {
  const res = await fetch(`${BASE}/trips`);
  if (!res.ok) {
    throw new Error(`GET /trips failed: ${res.status}`);
  }
  return (await res.json()) as ITrip[];
};
