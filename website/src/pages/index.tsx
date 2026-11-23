import type { ReactNode } from 'react';

import { HomePage } from '@internal/docusaurus-theme/HomePage';
import frame from '@internal/docusaurus-theme/terminal-window.module.css';
import { TerminalWindow } from '@internal/docusaurus-theme/TerminalWindow';

// Placeholder homepage: replace the opener, features and animation in every Tool.
const FEATURES = [
  { title: 'First feature', description: 'What the Tool does that nothing else does.' },
  { title: 'Second feature', description: 'Where it fits: CLI, CI, API.' },
  { title: 'Third feature', description: 'Why a team keeps it once installed.' },
];

const OPENER = 'One or two sentences on the problem this Tool removes.';

const Home = (): ReactNode => (
  <HomePage
    features={FEATURES}
    install="npm install --save-dev @ladamczyk/cli-template"
    opener={OPENER}
  >
    <TerminalWindow label="Animation: the Tool runs and passes.">
      <div className={frame.terminal}>
        <div className={frame.prompt}>$ npx cli-template</div>
        <div>✔ All good.</div>
      </div>
    </TerminalWindow>
  </HomePage>
);

export default Home;
