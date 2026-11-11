# Contributing to `oidc-token-action`

Thank you for your interest in contributing to `oidc-token-action`! Your effort and expertise are invaluable to our project. To ensure our community remains inclusive and respectful, please read and adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Guide for New Contributors

For an overview of the project, we recommend starting by reading the [README](./README.md).

## Development

### Prerequisites

- Node.js 24 (the GitHub Actions runtime)
- npm

### Setup

```sh
npm ci
```

### Build

```sh
npm run build
```

This uses esbuild to bundle `src/index.ts` and `src/cleanup.ts` into `dist/`. The `dist/` directory is committed to the repository so that the action can run without a build step.

### Lint

```sh
npm run lint
```

### Type-check and test

```sh
npm run typecheck
npm run build
npm test
```

The tests execute the standalone bundles with local token endpoint fixtures; they do not require live GitHub or ConductorOne credentials. Run `npm run all` for lint, type-check, build, and tests together.

Keep TypeScript within the versions supported by `typescript-eslint` when upgrading dependencies.

The `minimatch` override updates the lint tooling's v10 dependency to patched v11 to address [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Remove it once ESLint and typescript-eslint depend on a patched version themselves; validate lint file discovery when changing it.

### Making changes

1. Edit the TypeScript source files in `src/`.
2. Run `npm run all` to validate changes and regenerate `dist/`.
3. Commit both the source changes and the updated `dist/` files.

The CI workflow will fail if `dist/` is out of date.

## Get Involved

### Working with Issues

#### Creating a New Issue

If you encounter a problem or think of a new feature, start by [searching existing issues](https://github.com/ConductorOne/oidc-token-action/issues) to see if it has already been reported. If no relevant issue exists, feel free to open a new one using the appropriate [issue form](https://github.com/ConductorOne/oidc-token-action/issues/new).

#### Resolving an Issue

Peruse our [existing issues](https://github.com/ConductorOne/oidc-token-action/issues) to find one that suits your interests and skills. We don't assign issues, so if you see one you'd like to tackle, you're welcome to create a pull request with your proposed solution.

### Contribution Workflow

Here is a typical workflow for contributors:

1. Fork the `oidc-token-action` repository on GitHub.
2. Read the [README](./README.md) for usage information.
3. Explore the project, identify bugs, suggest enhancements, and propose solutions!

We appreciate every contribution, no matter how small!

## Reporting Security Issues

At ConductorOne, we prioritize security and take potential issues seriously. If you discover a security issue, please alert us as quickly as possible!

To protect our users, **DO NOT** create a public issue or pull request. Instead, send your report privately to the ConductorOne Security Team at [security@conductorone.com](mailto:security@conductorone.com).

We greatly appreciate security reports, and we will publicly acknowledge your contribution once the issue has been resolved and poses no risk to users. Thank you for helping us ensure the security and integrity of `oidc-token-action`!
