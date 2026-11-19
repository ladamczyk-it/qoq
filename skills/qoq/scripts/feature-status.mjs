#!/usr/bin/env node
// Rebuilds a feature's state from disk and prints it as JSON. Nothing is cached:
// the files are the state, so a chief of staff that restarted, or a repo session
// asking whether its next milestone may start, both get the same answer.
//
// Usage:   node feature-status.mjs --root <parent folder> --feature <slug>
//
// Exit code: 0 with the report on stdout; 1 when feature.json or the BRD is
// missing or unreadable (stderr says which).

import { loadFeature } from './feature-files.mjs';
import { featureState } from './feature-state.mjs';

const { slug, feature, brd, indexes } = loadFeature();

process.stdout.write(`${JSON.stringify(featureState({ slug, feature, brd, indexes }), null, 2)}\n`);
