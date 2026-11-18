// Shaped like skills/qoq/assets/plan-template.md: one delivered milestone, one
// live, one withdrawn.
export const INDEX = `# Trip Tags Implementation Plan

**Goal:** tags
**Plan status:** in-progress

## Milestones

| #   | Milestone              | Status               | Depends on | Summary |
| --- | ---------------------- | -------------------- | ---------- | ------- |
| M1  | [Done](m1-done.md)     | delivered 2026-10-20 | none       | x       |
| M2  | [Live](m2-live.md)     | in-progress          | M1         | y       |
| M3  | [Gone](m3-gone.md)     | withdrawn — replan   | M2         | z       |
`;

export const M1 = `# Milestone 1: Done

## Outcome

**Delivered:** 2026-10-20 — x
**Tickets:** 1.1 One \`abc1230\` · 1.2 Two words \`abc1231\`

## Tickets

### Ticket 1.1: One

- **Status:** done

### Ticket 1.2: Two words

- **Status:** done
`;

export const M2 = `# Milestone 2: Live

## Scope

**Size:** S

## Tickets

### Ticket 2.1: First

- **Status:** done

#### Execution

- **Complexity:** trivial

### Ticket 2.2: Second

- **Status:** in-progress

### Ticket 2.3: Third

- **Size:** S

## Definition of done

- [ ] All tickets above are \`done\`
`;

export const M3 = `# Milestone 3: Gone

## Tickets

### Ticket 3.1: Never

- **Status:** todo
`;

export const FILES: Record<string, string> = {
  '/repo/plans/p/index.md': INDEX,
  '/repo/plans/p/m1-done.md': M1,
  '/repo/plans/p/m2-live.md': M2,
  '/repo/plans/p/m3-gone.md': M3,
};
