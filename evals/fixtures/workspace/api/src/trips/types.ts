export interface ITrip {
  id: string;
  name: string;
  startsOn: string; // ISO date
}

export type TNewTrip = Omit<ITrip, 'id'>;
