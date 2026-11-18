import { readFileSync, writeFileSync } from 'node:fs';

// Keeps .claude-plugin/marketplace.json in step with its two sources of truth:
// metadata.version from the lib version, and every plugin's description from
// its own skill's frontmatter (plugin name = skills/<name>/). Both drifted once already, and a plugin description
// that disagrees with SKILL.md is a second, stale trigger blurb sitting in every
// session's context.
// Run by semantic-release (prepare step), never edited by hand — see release.config.js.
const manifestUrl = new URL('../.claude-plugin/marketplace.json', import.meta.url);
const packageUrl = new URL('../package.json', import.meta.url);
const skillPath = (name) => new URL(`../skills/${name}/SKILL.md`, import.meta.url);

const version = process.argv[2] ?? JSON.parse(readFileSync(packageUrl, 'utf8')).version;
const descriptionOf = (name) => {
  const description = readFileSync(skillPath(name), 'utf8').match(/^description: (.*)$/m)?.[1];

  if (!description) {
    throw new Error(`No description: line in skills/${name}/SKILL.md`);
  }

  return description;
};

const source = readFileSync(manifestUrl, 'utf8');
const names = JSON.parse(source).plugins.map((plugin) => plugin.name);

// Patched as text, not re-serialised, so the file keeps its Prettier formatting.
// Function replacers, because both values can contain `$`. Each entry's
// description is the one right after its own "name", so plugins never swap.
const patched = names.reduce(
  (text, name) =>
    text.replace(
      new RegExp(`("name":\\s*"${name}",\\s*"description":\\s*)"(?:[^"\\\\]|\\\\.)*"`),
      (_, head) => head + JSON.stringify(descriptionOf(name))
    ),
  source.replace(/("metadata":\s*\{[^}]*?"version":\s*")[^"]*/, (_, head) => head + version)
);

const parsed = JSON.parse(patched);
const stale = parsed.plugins.filter((plugin) => plugin.description !== descriptionOf(plugin.name));

if (parsed.metadata.version !== version || stale.length > 0) {
  throw new Error(
    `Failed to sync marketplace.json (version ${version}; stale: ${stale.map((p) => p.name).join(', ') || 'none'})`
  );
}

writeFileSync(manifestUrl, patched);

console.log(
  `marketplace.json -> version ${version}, descriptions from ${names.map((n) => `skills/${n}/SKILL.md`).join(', ')}`
);
