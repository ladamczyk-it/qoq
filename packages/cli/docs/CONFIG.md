# General settings

There are two general settings:

- `srcPath` (default to `./src`) that is used as a fallback to tools execution.
- `configPaths` via:

```js
{
    configPaths: {
        eslint: '/eslint.config.js',
        prettier: '/.prettierrc',
        stylelint: '/stylelint.config.js',
    }
}
```

where every entry has defaults as above, any override needs to start with leading slash `/` that is translated to `${process.cwd()}/`.

Let's say You execute `qoq --check` in project root path and `Eslint` config is in `configs` dir with name `eslint.config.local.js` oveeride should be then `/configs/eslint.config.local.js`.

# NPM

NPM dependencies check execution can be configured via:

```js
{
  npm: {
    checkOutdatedEvery: 1;
  }
}
```

where:

- `checkOutdatedEvery` is `number` that tells how often should we check dependencies. Defaults to `1` day.

# Prettier

Prettier execution can be configured via:

```js
{
    prettier: {
        sources: [...]
    }
}
```

where:

- `sources` is `string[]` that holds paths to format. Defaults to `[${srcPath}]`.

Execution will respect `.prettierignore` config.

# JSCPD

JSCPD execution can be configured via:

```js
{
    jscpd: {
        format: [...],
        ignore: [...],
        threshold: 2
    }
}
```

where:

- `format` described in [source docs](https://github.com/kucherenko/jscpd/tree/master/apps/jscpd#format)
- `ignore` described in [source docs](https://github.com/kucherenko/jscpd/tree/master/apps/jscpd#ignore)
- `threshold` described in [source docs](https://github.com/kucherenko/jscpd/tree/master/apps/jscpd#threshold), default to `2`

# Knip

Knip execution can be configured via:

```js
{
    knip: {
        entry: [...],
        project: [...],
        ignore: [...],
        ignoreDependencies: [...],
        ignoreBinaries: [...]
    }
}
```

where:

- `entry` described in [source docs](https://knip.dev/reference/configuration#entry), defaults to `[${srcPath}/{index,cli,main,root}.{ts,tsx,js,jsx}]` (file extensions are retreived from installed qoq modules)
- `project` described in [source docs](https://knip.dev/reference/configuration#project-1), defaults to `[${srcPath}/**/*.{ts,tsx,js,jsx}]` (file extensions are retreived from installed qoq modules)
- `ignore` described in [source docs](https://knip.dev/reference/configuration#ignore)
- `ignoreDependencies` described in [source docs](https://knip.dev/reference/configuration#ignoredependencies), defaults to `['@ladamczyk/qoq-*']`
- `ignoreBinaries` described in [source docs](https://knip.dev/reference/configuration#ignorebinaries)

# Eslint

Requires standard [configuration objects](https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects) but You can extend QoQ templates via `template` prop in each config where value is valid [@ladamczyk/qoq-eslint-v9-\*](https://www.npmjs.com/search?q=%40ladamczyk%2Fqoq-eslint-v9-) package eg:

```js
{
    eslint: [
        {
            template: 'qoq-eslint-v9-ts',
            files: ['packages/**/src/**/*.ts'],
            ignores: ['**/*.spec.ts'],
            ...
        },
        {
            template: 'qoq-eslint-v9-ts-vitest',
            files: ['packages/**/src/**/*.spec.ts'],
            ignores: [],
            ...
        }
        ...
    ]
}
```

# Stylelint

Requires standard [configuration object](https://stylelint.io/user-guide/configure) but You can extend QoQ templates via `template` prop in each config where value is valid [@ladamczyk/qoq-stylelint-\*](https://www.npmjs.com/search?q=%40ladamczyk%2Fqoq-stylelint-) package eg:

```js
{
    stylelint: {
        strict: false
        template: 'qoq-stylelint-css',
        ...
    }
}
```
