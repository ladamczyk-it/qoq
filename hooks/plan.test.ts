import { expect, test } from 'claude-code/testing';

import { parsePlan } from './plan';
import { PLAN } from './plan.fixture';

test('a plan reads as its title, status, milestones and every ticket', () => {
  expect(parsePlan(PLAN)).toEqual({
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

test('a file without a plan status is not a plan', () => {
  expect(parsePlan('# Notes\n\n## Milestone 1: x\n')).toBeNull();
});

test('a ticket status does not leak into the next milestone', () => {
  const plan = parsePlan(`**Plan status:** approved

## Milestone 1: A

### Ticket 1.1: One

- **Status:** done

## Milestone 2: B

- **Status:** blocked
`);

  expect(plan?.milestones.map((m) => m.tickets)).toEqual([
    [{ id: '1.1', name: 'One', status: 'done' }],
    [],
  ]);
});
