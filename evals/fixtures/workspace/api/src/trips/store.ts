import { randomUUID } from 'node:crypto';

import type { ITrip, TNewTrip } from './types.js';

export interface IStore {
  list: () => ITrip[];
  add: (input: TNewTrip) => ITrip;
}

export const createStore = (): IStore => {
  const trips = new Map<string, ITrip>();

  return {
    list: () => [...trips.values()],
    add: (input) => {
      const trip = { id: randomUUID(), ...input };
      trips.set(trip.id, trip);
      return trip;
    },
  };
};
