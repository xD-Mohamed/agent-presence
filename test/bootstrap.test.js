import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test(
  "Windows direct installer validates runtimes, archives, hashes and bounded download failures",
  { skip: process.platform !== "win32", timeout: 30000 },
  () => {
    const repo = fileURLToPath(new URL("../", import.meta.url)).replace(
      /'/g,
      "''",
    );
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `& ([scriptblock]::Create((Get-Content -LiteralPath '${repo}scripts/test-bootstrap-unit.ps1' -Raw))) -RepoRoot '${repo}'`,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 25000 },
    );
  },
);
