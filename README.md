# pi-wsl-clipboard-image

WSL-first clipboard image bridge for [Pi](https://github.com/badlogic/pi-mono).

This package solves a very specific but common workflow problem:

- you run Pi inside **WSL**
- you take screenshots with **Windows tools** like `Win+Shift+S`
- the image lands in the **Windows clipboard**
- Pi, running as a Linux process, cannot reliably read that clipboard image directly

`pi-wsl-clipboard-image` bridges that gap.

It reads the current **Windows clipboard image** via PowerShell, saves it into a temp PNG visible from WSL, and inserts the file path into Pi's editor so Pi can inspect the screenshot reliably.

## Why this exists

If you develop inside WSL, you are still often using a **Windows-native clipboard**:

- Snipping Tool
- browser copy-image actions
- Windows desktop apps
- VS Code / Cursor / Antigravity running as Windows apps

That means the screenshot lives on the Windows side even though your shell and coding agent live in Linux userland.

This package uses PowerShell only as a **Windows clipboard adapter**, not as your shell.

## What it adds

- `/clipimg` — save the current Windows clipboard image and insert its path into the editor
- `/screenshot` — friendlier alias for the same action
- `F6` — shortcut for the same screenshot workflow

## Install

### Install from GitHub

```bash
pi install git:github.com/StartupBros/pi-wsl-clipboard-image
```

### Try without installing

```bash
pi -e git:github.com/StartupBros/pi-wsl-clipboard-image
```

## Usage

### Default interactive flow

1. Take a screenshot with `Win+Shift+S`
2. Focus Pi
3. Press `F6`
4. Press `Enter`

Pi will insert something like:

```text
Please inspect this screenshot: /tmp/clipboard-1741639192660.png
```

Pi can then inspect that image by file path.

### Command-based flow

You can also run either command manually:

```text
/screenshot
```

or

```text
/clipimg
```

## Optional VS Code / Antigravity terminal mapping

Some VS Code-family terminals do not forward all keys cleanly to terminal TUIs. If `F6` is not reaching Pi directly, you can map the terminal to send `/screenshot`.

Example keybinding file:

- [`examples/vscode-terminal-keybindings.json`](./examples/vscode-terminal-keybindings.json)

That snippet binds `F6` to:

```text
/screenshot
```

inside the integrated terminal.

## Requirements

- WSL
- Windows clipboard access from WSL
- one of these available from WSL:
  - `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`
  - `C:\Program Files\PowerShell\7\pwsh.exe`

## Behavior notes

- This package is intentionally **WSL-first**. On non-WSL environments it will show a clear error instead of pretending to work.
- Clipboard image extraction tries `Get-Clipboard -Format Image` first, then falls back to WinForms clipboard APIs.
- Output images are written to WSL temp storage as PNG files.
- The temporary PowerShell script used for clipboard extraction is deleted after execution.

## Why not rely on native image paste?

Because in real Windows + WSL + IDE-terminal setups, native terminal image paste is often unreliable.

A temp file path is:

- explicit
- debuggable
- stable across terminals
- easy for Pi to consume

This package chooses reliability over magic.

## Development

```bash
pnpm install
pnpm typecheck
pi -e .
```

## Release process

- CI runs `pnpm typecheck` on pushes and pull requests
- tags matching `v*` trigger the npm publish workflow
- npm publishing expects a repository secret named `NPM_TOKEN`
- changes are tracked in [`CHANGELOG.md`](./CHANGELOG.md)
- contribution guidance lives in [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## License

MIT
