# Contributing

Thanks for contributing to `pi-wsl-clipboard-image`.

## Development

```bash
pnpm install
pnpm typecheck
```

Try the package locally in Pi:

```bash
pi -e .
```

## Project goals

This package should stay:
- WSL-first and opinionated about the actual problem being solved
- small, reliable, and easy to install
- focused on bridging Windows clipboard images into Pi
- conservative about editor and terminal assumptions

## Scope

Good contributions include:
- better Windows clipboard decoding behavior
- clearer WSL detection and error messages
- compatibility improvements across Windows PowerShell and PowerShell 7
- documentation and example improvements
- CI and typecheck improvements

Please avoid baking in editor-specific personal workflows as core behavior. Optional examples are great; hard-coded IDE assumptions are not.

## Releases

```bash
pnpm typecheck
git tag vX.Y.Z
git push origin main --tags
```

GitHub Actions publishes tagged releases to npm when `NPM_TOKEN` is configured.
