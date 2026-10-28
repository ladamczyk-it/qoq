# Orders Implementation Plan

**Goal:** customers can fetch a single order by id over HTTP
**Architecture:** an Express router over a tiny in-memory db; lookups throw,
routes translate errors to status codes.
**Requirements source:** GET /orders/:id returns the order, 404 when it doesn't
exist; amounts are shown formatted
**Commands:** build `tsc --noEmit` · test `vitest run`
**Plan status:** in-progress

---

## Milestone 2: Order lookup

**Size:** S
**Goal:** GET /orders/:id returns the order with its formatted total, or 404
**Depends on:** Milestone 1
**Contracts:** lookups throw `NotFound` (`src/errors.ts`) on a missing row;
routes map `NotFound` to 404 and nothing else does

### Ticket 2.1: loadOrder

- **Status:** done
- **Files:**
  - Create: `src/orders/load.ts`
  - Create: `src/orders/load.spec.ts`
- **Acceptance criteria:**
  - [x] `loadOrder(id)` returns the order for an existing id
  - [x] `loadOrder(id)` throws `NotFound` for a missing id

### Ticket 2.2: GET /orders/:id

- **Status:** done
- **Depends on:** Ticket 2.1
- **Files:**
  - Create: `src/orders/route.ts`
  - Modify: `src/app.ts`
- **Acceptance criteria:**
  - [x] responds 200 with the order and its total formatted as currency
  - [x] responds 404 when `loadOrder` throws `NotFound`
