import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

const STATUS_KEY = "wsl-clipboard-image";
const STATUS_TEXT = "F6 screenshot · /screenshot · /hotkeys";
const POWERSHELL_CANDIDATES = [
  "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
  "/mnt/c/Program Files/PowerShell/7/pwsh.exe",
] as const;

function isWsl(): boolean {
  if (process.platform !== "linux") {
    return false;
  }

  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
    return true;
  }

  try {
    return readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

function getPowerShellPath(): string | undefined {
  return POWERSHELL_CANDIDATES.find((candidate) => existsSync(candidate));
}

function buildPowerShellScript(): string {
  return `param([string]$OutPath)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if ([string]::IsNullOrWhiteSpace($OutPath)) {
  throw "OutPath is not set"
}

$image = $null
try {
  $image = Get-Clipboard -Format Image -ErrorAction Stop
} catch {
}

if ($null -eq $image) {
  $image = [System.Windows.Forms.Clipboard]::GetImage()
}

if ($null -eq $image) {
  throw "Clipboard image could not be decoded. Try copying the image again with Win+Shift+S."
}

$bitmap = $null
try {
  if ($image -is [System.Drawing.Bitmap]) {
    $bitmap = $image
  } else {
    $bitmap = New-Object System.Drawing.Bitmap $image
  }

  $bitmap.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

  if (-not (Test-Path -LiteralPath $OutPath)) {
    throw "Failed to save clipboard image to $OutPath"
  }
} finally {
  if ($bitmap -and -not [object]::ReferenceEquals($bitmap, $image)) {
    $bitmap.Dispose()
  }
  if ($image -is [System.IDisposable]) {
    $image.Dispose()
  }
}
`;
}

function cleanErrorMessage(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? "Unable to read clipboard image";
}

async function toWindowsPath(pi: ExtensionAPI, path: string): Promise<string> {
  const result = await pi.exec("wslpath", ["-w", path], { timeout: 5000 });

  if (result.code !== 0) {
    throw new Error(cleanErrorMessage(result.stderr || result.stdout || `Failed to convert path: ${path}`));
  }

  const windowsPath = result.stdout.trim();
  if (!windowsPath) {
    throw new Error(`Failed to convert path: ${path}`);
  }

  return windowsPath;
}

async function saveClipboardImage(pi: ExtensionAPI): Promise<string> {
  if (!isWsl()) {
    throw new Error("pi-wsl-clipboard-image only runs inside WSL.");
  }

  const powerShellPath = getPowerShellPath();
  if (!powerShellPath) {
    throw new Error("Could not find powershell.exe from WSL.");
  }

  const tempDir = mkdtempSync(join(os.tmpdir(), "pi-wsl-clipboard-image-"));
  const scriptPath = join(tempDir, "save-clipboard-image.ps1");
  const outputPath = join(os.tmpdir(), `clipboard-${Date.now()}.png`);

  writeFileSync(scriptPath, buildPowerShellScript(), "utf8");

  try {
    const windowsScriptPath = await toWindowsPath(pi, scriptPath);
    const windowsOutputPath = await toWindowsPath(pi, outputPath);

    const result = await pi.exec(
      powerShellPath,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-STA",
        "-File",
        windowsScriptPath,
        windowsOutputPath,
      ],
      { timeout: 15000 },
    );

    if (result.code !== 0) {
      throw new Error(cleanErrorMessage(result.stderr || result.stdout));
    }

    return outputPath;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function insertClipboardImagePath(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) {
    return;
  }

  try {
    const path = await saveClipboardImage(pi);
    const current = ctx.ui.getEditorText().trimEnd();
    const nextText = current.length === 0
      ? `Please inspect this screenshot: ${path}`
      : `${current}\n\nScreenshot: ${path}`;

    ctx.ui.setEditorText(nextText);
    ctx.ui.notify(`Inserted clipboard image path: ${path}`, "info");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read clipboard image";
    ctx.ui.notify(message, "error");
  }
}

function registerClipboardCommand(pi: ExtensionAPI, name: string, description: string): void {
  pi.registerCommand(name, {
    description,
    handler: async (_args, ctx) => {
      await insertClipboardImagePath(pi, ctx);
    },
  });
}

export default function wslClipboardImage(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI || !isWsl()) {
      return;
    }

    ctx.ui.setStatus(STATUS_KEY, STATUS_TEXT);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (!ctx.hasUI) {
      return;
    }

    ctx.ui.setStatus(STATUS_KEY, undefined);
  });

  registerClipboardCommand(
    pi,
    "clipimg",
    "Save the Windows clipboard image to a temp file and insert its path into the editor",
  );
  registerClipboardCommand(
    pi,
    "screenshot",
    "Insert the current Windows clipboard screenshot into the editor as a temp file path",
  );

  pi.registerShortcut("f6", {
    description: "Insert Windows clipboard screenshot path",
    handler: async (ctx) => {
      await insertClipboardImagePath(pi, ctx);
    },
  });
}
