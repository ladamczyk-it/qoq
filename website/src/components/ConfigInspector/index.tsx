import { type FC, useCallback, useEffect, useRef } from 'react';

import { useColorMode } from '@docusaurus/theme-common';
import Translate, { translate } from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';

import styles from './styles.module.css';
import { INSPECTOR_VARIANTS, type TPresetVariant } from './variants';

interface IConfigInspectorProps {
  // Preset to embed, e.g. `eslint-v9-ts-react`.
  readonly variant: TPresetVariant;
}

// VueUse `useColorMode` settings the inspector is built with.
const COLOR_SCHEME_STORAGE_KEY = 'vueuse-color-scheme';

const ConfigInspector: FC<IConfigInspectorProps> = ({ variant }) => {
  const { colorMode } = useColorMode();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeVariant =
    INSPECTOR_VARIANTS.find((entry) => entry.variant === variant) ?? INSPECTOR_VARIANTS[0];

  const inspectorUrl = useBaseUrl(`/config-inspector/${activeVariant.variant}/`);

  // Keep the inspector's light/dark mode in lockstep with the Docusaurus page.
  // The iframe is same-origin, so we both seed VueUse's storage key (which the
  // app reacts to via the `storage` event) and set the class directly for an
  // immediate, flash-free switch.
  const syncColorMode = useCallback(() => {
    const isDark = colorMode === 'dark';

    try {
      window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Storage may be unavailable (e.g. privacy mode); the class set below still applies.
    }

    const inspectorDocument = iframeRef.current?.contentDocument;
    if (!inspectorDocument) {
      return;
    }

    const root = inspectorDocument.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, [colorMode]);

  useEffect(syncColorMode, [syncColorMode]);

  return (
    <div className={styles.inspector}>
      <div className={styles.toolbar}>
        <code className={styles.packageName}>{activeVariant.packageName}</code>

        <a
          className={styles.openLink}
          href={inspectorUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Translate>Open full view ↗</Translate>
        </a>
      </div>

      <iframe
        ref={iframeRef}
        className={styles.frame}
        src={inspectorUrl}
        title={translate(
          { message: 'ESLint Config Inspector — {preset}' },
          { preset: activeVariant.label }
        )}
        loading="lazy"
        onLoad={syncColorMode}
      />
    </div>
  );
};

export default ConfigInspector;
