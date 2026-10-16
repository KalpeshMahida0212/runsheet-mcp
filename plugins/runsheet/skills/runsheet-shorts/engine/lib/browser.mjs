// The browser that draws the frames: the creator's own Chrome or Edge, so nothing big is downloaded.
// CHROME_PATH overrides; Playwright's own Chromium, if one is installed, is the last resort.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export function findBrowser() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const env = process.env;
  const candidates = [];
  if (process.platform === "win32") {
    for (const base of [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean)) {
      candidates.push(join(base, "Google", "Chrome", "Application", "chrome.exe"), join(base, "Microsoft", "Edge", "Application", "msedge.exe"));
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    );
  } else {
    for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]) {
      try { candidates.push(execFileSync("which", [name], { encoding: "utf8" }).trim()); } catch { /* not installed */ }
    }
  }
  const found = candidates.find((p) => p && existsSync(p));
  if (found) return found;
  // Playwright's cache, if the creator has one from other work.
  const cache = process.platform === "win32" ? join(env.LOCALAPPDATA || "", "ms-playwright") : join(env.HOME || "", process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright");
  if (existsSync(cache)) {
    for (const d of readdirSync(cache).filter((x) => x.startsWith("chromium")).sort().reverse()) {
      for (const rel of [["chrome-win64", "chrome.exe"], ["chrome-win", "chrome.exe"], ["chrome-linux", "chrome"], ["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"]]) {
        const p = join(cache, d, ...rel);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error("No Chrome or Edge found. Install Google Chrome, or set CHROME_PATH to a Chromium-based browser.");
}
