import type { ReactNode } from 'react';

import { TerminalWindow } from '@internal/docusaurus-theme/TerminalWindow';

import styles from './styles.module.css';

/**
 * Captured from `npm run qoq:check` in this repo on 2026-11-24 with qoq 7.3.1,
 * ANSI codes stripped; the command exited 0. The run also printed non-blocking
 * findings (npm-outdated rows, two JSCPD clones, justify-disable warnings) that
 * are left out here: only each tool's heading and result line are shown, verbatim.
 */
const PROMPT = '$ npx qoq --check';

const LINES = [
  { text: 'Running Knip:', className: styles.tool },
  { text: 'Running Prettier:', className: styles.tool },
  { text: 'Running JSCPD:', className: styles.tool },
  { text: 'Found 2 clones.', className: styles.warn },
  { text: 'Running Eslint:', className: styles.tool },
  { text: '✔ Eslint done.', className: styles.ok },
  { text: 'Running Structurelint:', className: styles.tool },
  { text: '✔ Structure is valid (packages).', className: styles.ok },
  { text: 'Running Skillslint:', className: styles.tool },
  { text: 'All good!', className: styles.ok },
  { text: 'Running Justify-disable:', className: styles.tool },
  {
    text: '✔ No unjustified disable directives (221 files scanned).',
    className: styles.ok,
  },
  { text: '30 warning(s).', className: styles.warn },
];

const LABEL = 'Animation: qoq --check runs each tool and reports its result.';

export const QoqAnimation = (): ReactNode => (
  <TerminalWindow className={styles.wrapper} label={LABEL}>
    <div className={styles.terminal}>
      <div className={styles.prompt}>{PROMPT}</div>
      {LINES.map(({ text, className }, i) => (
        <div
          key={text}
          className={`${styles.line} ${className}`}
          style={{ '--i': i + 2 } as React.CSSProperties}
        >
          {text}
        </div>
      ))}
    </div>
  </TerminalWindow>
);
