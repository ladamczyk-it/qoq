import { readFileSync, writeFileSync } from 'node:fs';

// Keeps .claude-plugin/marketplace.json in step with its two sources of truth:
// metadata.version from the lib version, and the plugin description from the
// skill's own frontmatter. Both drifted once already, and a plugin description
// that disagrees with SKILL.md is a second, stale trigger blurb sitting in every
// session's context.
// Run by semantic-release (prepare step), never edited by hand — see release.config.js.
const manifestUrl = new URL('../.claude-plugin/marketplace.json', import.meta.url);
const packageUrl = new URL('../package.json', import.meta.url);
const skillUrl = new URL('../skills/qoq/SKILL.md', import.meta.url);

const version = process.argv[2] ?? JSON.parse(readFileSync(packageUrl, 'utf8')).version;
const description = readFileSync(skillUrl, 'utf8').match(/^description: (.*)$/m)?.[1];

if (!description) {
  throw new Error('No description: line in skills/qoq/SKILL.md');
}

// Patched as text, not re-serialised, so the file keeps its Prettier formatting.
// Function replacers, because both values can contain `$`.
const patched = readFileSync(manifestUrl, 'utf8')
  .replace(/("metadata":\s*\{[^}]*?"version":\s*")[^"]*/, (_, head) => head + version)
  .replace(
    /("plugins":[\s\S]*?"description":\s*)"(?:[^"\\]|\\.)*"/,
    (_, head) => head + JSON.stringify(description)
  );

const parsed = JSON.parse(patched);

if (parsed.metadata.version !== version || parsed.plugins[0].description !== description) {
  throw new Error(`Failed to sync marketplace.json (version ${version})`);
}

writeFileSync(manifestUrl, patched);

console.log(`marketplace.json -> version ${version}, description from SKILL.md`);
