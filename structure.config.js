/** @type {import('@ladamczyk/structurelint').IStructureConfig} */
const config = {
  structureRoot: 'packages',
  rules: {
    any_file: { name: '*' },
    any_folder: { name: '*', children: [{ ruleId: 'any_file' }, { ruleId: 'any_folder' }] },
  },
  structure: [
    {
      name: '{kebab-case}',
      children: [
        {
          name: 'src',
          required: true,
          children: [{ ruleId: 'any_file' }, { ruleId: 'any_folder' }],
        },
        { name: 'AGENTS.md', required: true },
        { name: 'CLAUDE.md', required: true },
        { name: 'LICENSE', required: true },
        { name: 'README.md', required: true },
        { name: 'package.json', required: true },
        { ruleId: 'any_file' },
        { ruleId: 'any_folder' },
      ],
    },
  ],
};

export default config;
