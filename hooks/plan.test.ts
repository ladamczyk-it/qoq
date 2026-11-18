import { expect, test } from 'claude-code/testing';

import { parsePlan, parseTickets } from './plan';
import { INDEX, M1, M2, M3 } from './plan.fixture';

const FILES = { 'm1-done.md': M1, 'm2-live.md': M2, 'm3-gone.md': M3 };

test('a plan reads as its title, status, live milestones and every ticket', () => {
  expect(parsePlan(INDEX, FILES)).toEqual({
    title: 'Trip Tags',
    status: 'in-progress',
    milestones: [
      {
        number: 1,
        name: 'Done',
        delivered: '2026-10-20',
        tickets: [
          { id: '1.1', name: 'One', status: 'done' },
          { id: '1.2', name: 'Two words', status: 'done' },
        ],
      },
      {
        number: 2,
        name: 'Live',
        delivered: null,
        tickets: [
          { id: '2.1', name: 'First', status: 'done' },
          { id: '2.2', name: 'Second', status: 'in-progress' },
          { id: '2.3', name: 'Third', status: 'todo' },
        ],
      },
    ],
  });
});

test('an index without a plan status is not a plan', () => {
  expect(parsePlan('# Notes\n\n| M1 | [x](m1-x.md) | todo | none | x |\n', {})).toBeNull();
});

test('a milestone file the index names but nobody wrote has no tickets', () => {
  expect(parsePlan(INDEX, {})?.milestones.map((m) => m.tickets)).toEqual([[], []]);
});

test('a status under a later heading does not leak into the ticket before it', () => {
  expect(
    parseTickets(`### Ticket 1.1: One

## Definition of done

- **Status:** blocked
`)
  ).toEqual([{ id: '1.1', name: 'One', status: 'todo' }]);
});
