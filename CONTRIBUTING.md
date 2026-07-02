# Contributing to Artie-Lens

Thanks for your interest in improving Artie-Lens!

## Development setup

```bash
git clone https://github.com/ariusxi/artie-lens.git
cd artie-lens
nvm use            # uses Node 22 (see .nvmrc)
yarn install
```

Common scripts:

| Script | Purpose |
| --- | --- |
| `yarn build` | Bundle the CLI and type declarations with Rollup. |
| `yarn test` | Run the Vitest suite once. |
| `yarn test:watch` | Run Vitest in watch mode. |

Please add or update tests under `test/` for any behavior change. Metric changes
should be validated against the CK definitions they implement.

## Commit messages (required)

Releases are fully automated by [semantic-release](https://semantic-release.gitbook.io/),
which derives the next version and changelog from commit history. Commits **must** follow
[Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Effect on version | Example |
| --- | --- | --- |
| `fix:` | patch (x.y.**z**) | `fix: exclude static methods from LCOM` |
| `feat:` | minor (x.**y**.z) | `feat: add DIT metric` |
| `feat!:` or `BREAKING CHANGE:` footer | major (**x**.y.z) | `feat!: change config schema` |
| `chore:`, `docs:`, `test:`, `ci:`, `refactor:` | no release | `docs: document RFC limitations` |

Commits that don't match a release type won't trigger a publish — that's expected.

## Pull requests

1. Branch off `main`.
2. Make your change with tests.
3. Ensure `yarn build` and `yarn test` pass locally.
4. Open a PR against `main`. CI runs the test suite on every PR.

Once merged into `main`, semantic-release publishes the new version to npm and
creates the matching Git tag, GitHub release, and `CHANGELOG.md` entry automatically.
