# Window & Viewport Resizer (Chrome extension)

[日本語](README.md) | **English**

> **Current version: `0.4.0` (beta `0.4.0-beta.1`)**

A Chrome extension (Manifest V3 / Plasmo framework) that resizes the window or viewport to a preset or custom size, and captures screenshots of the visible area or the full page and downloads them.

## Overview

- Resizing for both window size and viewport size
- Resolution templates grouped by aspect ratio (16:9: HD/WXGA/HD+/FHD, 4:3: VGA/SVGA/XGA/UXGA)
- Per-template, per-mode (window-based / viewport-based) offset (margin) values configurable on the Options page
- When a resize would push the window off the screen, it is moved to stay on the screen without changing the size (can be turned off in the settings)
- Add, edit and delete custom sizes (a correction offset can be specified in window-based mode). The list is always shown right below the templates, and the + next to its heading opens the add form. The name has a default value, and a button fills in the current size
- Popup UI opened from the toolbar icon (theme selectable in the settings: light, dark or follow the browser)
- Screenshots of the visible tab or the full page (scrolling capture + stitching)
- Saved into the `Captures` folder under Downloads (the folder name can be changed). The format is selectable in the settings: PNG (default) / WebP / JPEG
- Copy screenshots to the clipboard (PNG only)
- Icon-button UI with Tabler Icons (Visible area / Full page rows x Download / Copy, plus area selection on the Full page row)
- Choose a scrollable area on the page to capture (candidates are highlighted, and the clicked area can be saved or copied)
- Delay timer for screenshots (3, 5 or 10 seconds; for menus that appear on hover)
- Keyboard shortcuts (resizing to presets and 5 custom size slots, and each kind of screenshot). No keys are assigned by default; assign only the ones you want at `chrome://extensions/shortcuts`
- Share buttons for social networks (X, Facebook, LINE, Threads, Bluesky, LinkedIn and Reddit; they open the post screen)
- Local / sync storage switching via `@plasmohq/storage`
- Factory reset that restores settings, custom sizes and preset offsets to their defaults
- Multilingual UI (Japanese / English). Choose "Auto / 日本語 / English" under "Language" on the Options page ("Auto" follows the browser UI language; anything other than Japanese falls back to English)

## Bug reports and feedback

Please report bugs and feature requests on the GitHub Issues page.

- [Issues](https://github.com/uc4696/window-resizer-screenshot/issues)

## Tech stack / Project layout

### Tech stack

- [Plasmo](https://www.plasmo.com/) (Chrome Extension Framework)
- TypeScript / React
- `@plasmohq/storage`
- Chrome Extension Manifest V3
- E2E tests: [Playwright](https://playwright.dev/) + Chrome for Testing (Beta channel in CI)

### Project layout

The project uses Plasmo's [src directory](https://docs.plasmo.com/framework/customization/src) feature, and `tsconfig.json` maps `~*` to `./src/*`. **All Plasmo entry files (`popup.tsx` / `options.tsx` / `background.ts`, etc.) must therefore live under `src/`** (`assets/` stays at the project root).

```
.
├── assets/
│   ├── _locales/{en,ja}/messages.json  # Localized extension name/description
│   ├── icon-source.png             # Design source of the current icon (128x128)
│   ├── icon.png                    # Base PNG icon required by Plasmo (512x512)
│   ├── icon16.png / icon32.png / icon48.png / icon64.png / icon128.png  # Icons by size
│   ├── icon.svg                    # Old placeholder icon (kept for reference)
│   └── buymeacoffee-button.png     # Image for the support link
├── scripts/
│   ├── generate-icon.js            # Generates icons of each size from icon-source.png (uses sharp)
│   ├── copy-license.mjs            # Copies the Tabler Icons license into the build output (ZIP); runs automatically on build / package
│   ├── install-chrome.mjs          # Downloads Chrome for Testing for E2E tests (set CHROME_CHANNEL)
│   └── e2e-wsl.sh                  # Runs E2E tests on WSL2 with xvfb
├── tests/e2e/                      # E2E tests (Playwright), shared fixtures and a test server
├── tests/unit/                     # Unit tests (node:test)
├── playwright.config.ts            # Playwright configuration
├── .github/workflows/e2e-beta.yml  # Daily E2E run (Chrome Beta) and failure notifications
├── .github/funding.yml             # Support link settings (Buy Me a Coffee)
├── src/
│   ├── popup.tsx                   # Popup UI (template selection, custom sizes, screenshot buttons)
│   ├── style.css                   # Popup styles (dark mode supported)
│   ├── options.tsx                 # Options page
│   ├── options.css                 # Options page styles (dark mode supported)
│   ├── background.ts               # Screenshot capture and download handling (service worker)
│   ├── components/
│   │   ├── PresetGrid.tsx          # Template size buttons
│   │   ├── CustomSizeList.tsx      # Saved custom sizes: apply / edit / delete UI
│   │   ├── CustomSizeManager.tsx   # Add/edit form for custom sizes
│   │   ├── CaptureSection.tsx      # Screenshot rows (Download / Copy)
│   │   ├── Icon.tsx                # Inline Tabler Icons SVG
│   │   ├── ShareButton.tsx         # Share buttons for social networks
│   │   ├── ReviewPrompt.tsx        # Store rating request
│   │   └── SupportLink.tsx         # Support link
│   └── lib/
│       ├── types.ts                # Type definitions
│       ├── constants.ts            # Default templates, storage keys and other constants
│       ├── storage.ts              # Settings/data management with local/sync switching
│       ├── offset.ts               # Offset (correction value) calculation
│       ├── resize.ts               # Window / viewport resizing and validation
│       ├── screenshot.ts           # Visible Tab / Full Page screenshot capture (PNG/WebP/JPEG output)
│       ├── share.ts                # Builds the URLs of the social networks' post screens
│       ├── review-prompt.ts        # When to show the rating request, and its state
│       ├── theme.ts                # Applies the theme (light, dark or follow the browser)
│       ├── placement.ts            # Where to place a resized window so it stays on screen
│       ├── commands.ts             # Keyboard shortcut names and what they do
│       ├── page-copy.ts            # Copying from a shortcut (writes to the clipboard from the page)
│       ├── filename.ts             # Saved file name and path construction
│       ├── messages.ts             # Message types between popup and background
│       └── i18n/                   # Internationalization (messages.en.ts / messages.ja.ts / index.ts / useI18n.tsx)
├── package.json                    # Dependencies and manifest settings (permissions, etc.)
├── tsconfig.json                   # TypeScript settings (alias ~* -> ./src/*)
├── README.md / README.en.md        # Documentation (Japanese / English)
├── eslint.config.mjs               # ESLint settings (flat config)
└── .prettierrc / .gitignore
```

### Internationalization (i18n) implementation

- Translation dictionaries are `src/lib/i18n/messages.en.ts` (the source of keys) and `src/lib/i18n/messages.ja.ts` (typed so that it must contain the same keys). When adding a string, add the same key to both files; omissions are caught by `npx tsc --noEmit`.
- In code, use `t(key, params?)` from `src/lib/i18n/index.ts`. `{name}` style placeholders are supported. In React components, use `useI18n()` (`src/lib/i18n/useI18n.tsx`) so components re-render when the language changes.
- The language setting (`auto` / `ja` / `en`) is stored as `Settings.language` in `local` storage (and is included in the factory reset).
- The extension name and description (shown on `chrome://extensions` and the store) are managed in `assets/_locales/{en,ja}/messages.json` and referenced through `__MSG_*__` in `package.json` with `default_locale` set to `en`. They follow the browser language and are independent of the language setting on the Options page.

## Installation and development

1. Make sure Node.js (latest LTS or newer recommended) is installed.
2. Install the dependencies (PowerShell).

   ```powershell
   npm install
   ```

3. (Note for Windows with npm 11 or later)
   npm 11+ blocks install scripts of native modules such as `lmdb`, `@parcel/watcher`, `@swc/core`, `esbuild`, `msgpackr-extract` and `sharp` by default. If they stay blocked, `plasmo build` fails with `ERROR | Bindings not found.`
   After `npm install`, run the following to generate the native bindings.

   ```powershell
   npm rebuild
   ```

   (Re-running `npm install` may block them again, so run `npm rebuild` each time.)

- Start the dev server (with hot reload):

  ```powershell
  npm run dev
  ```

  This generates `build/chrome-mv3-dev`. In Chrome, open `chrome://extensions`, enable "Developer mode", click "Load unpacked" and select `build/chrome-mv3-dev`.

- Production build:

  ```powershell
  npm run build
  ```

  This generates `build/chrome-mv3-prod`.

- Create a package for the store (zip):

  ```powershell
  npm run package
  ```

  This generates `build/chrome-mv3-prod.zip`. When distributing a beta version, rename the file by adding `-v<version>-beta.<number>`, for example `window-resizer-screenshot-v0.2.1-beta.2.zip`.

- Format and lint the code:

  ```powershell
  npm run format
  npm run lint
  ```

  `npm run format` formats the source code in `src`, `tests`, `scripts`, etc. with Prettier (Markdown is excluded). `npm run lint` runs static analysis with ESLint.

### Unit tests

Run them with `npm test` (`tests/unit/`, no browser needed). They check the conditions for showing the rating request.

### E2E tests (automated tests)

The extension is loaded into a real browser with Playwright and Chrome for Testing. The tests cover resizing (presets, custom sizes, offsets), input validation, screenshots (visible area / full page), the options page, the rating request, and a permission check of the distributed `manifest.json`.

- **CI (GitHub Actions)**: `.github/workflows/e2e-beta.yml` runs **every day at 03:00 (JST)** against the **Beta** channel of Chrome (manual runs: "Run workflow" in the Actions tab). On failure it opens a GitHub issue (label `e2e-failure`; it comments on the existing open issue if there is one) and sends a Slack message.
  - Slack notifications require the repository secret `SLACK_WEBHOOK_URL` (a Slack Incoming Webhook URL).
  - Scheduled runs only work for the workflow on the default branch (`main`).
- **Local (WSL2, the usual way)**: runs on Ubuntu on WSL2 with xvfb, so no browser appears on the Windows screen and the clipboard does not change. Ubuntu needs Node 24 (installed with nvm), xvfb, xauth, rsync and unzip.

  ```powershell
  npm run test:e2e:wsl                                  # run everything
  npm run test:e2e:wsl -- tests/e2e/clipboard.spec.ts   # arguments are passed to Playwright
  npm run test:e2e:wsl -- --channel beta                # choose the Chrome channel
  npm run test:e2e:wsl -- --update-browser              # download the latest Chrome again
  ```

  Your working files are synced to `~/e2e/resizer` on WSL, and dependencies (only when `package-lock.json` changes), the build and the Chrome download are all handled on WSL. Results come back to `test-results/` on Windows, and the exit code is the one from the tests.
- **Local (Windows, before a release or to check Windows-only problems)**:

  ```powershell
  npm run build                 # tests load build/chrome-mv3-prod
  npm run test:install-browser  # download Chrome for Testing (Stable by default)
  npm run test:e2e              # run (a browser window opens on the screen)
  ```

  To reproduce on Beta, run `$env:CHROME_CHANNEL = "beta"; npm run test:install-browser`. The browser is stored in `.chrome-for-testing/` (not tracked by Git).
- **Notes**: the product only requests `activeTab`, which is granted only by a real user action (clicking the toolbar icon). The tests therefore load a temporary copy of the build with `host_permissions` added (the distributed build is not modified). The browser UI language is fixed to English.

## Specifications and limitations

### 1. Window-based resizing and measured size (OS differences / invisible borders)
- **Background**: On Windows (DWM: Desktop Window Manager), windows have invisible transparent borders (a few px on the left, right and bottom) for resizing. Display scaling (100% / 125% / 150%, etc.) can also cause pixel differences.
- **Symptom**: Even if you specify `1920x1080` through `chrome.windows.update`, the outer window size measured by OS screenshots or external capture tools may be a few pixels smaller (or larger), for example `1906x1073`. This difference cannot be detected from Chrome extension APIs.
- **Approach**:
  - **Templates**: Applied as-is (no offset) to stay independent of the environment.
  - **Custom sizes (offset feature)**: To make the measured outer window size match the target size in your OS/scaling environment, specify a "size correction offset" (width/height correction in px) when adding or editing a custom size. For example, if the measured width is 14px smaller and the height 7px smaller, register `+14` / `+7` as the offset.

### 2. Viewport-based resizing and the image size
- The size you set with viewport-based resizing is the size of the captured image. This also works on special pages such as `chrome://`.
- With a fractional display scale (125%, 150%, 175% and so on), window sizes are rounded and also depend on the window position. So on Windows and Linux, the window is aligned up to 3 px toward the top left and its size is corrected while checking the result. The window moves slightly on each resize, and one operation may change the size several times.
- If the exact size cannot be made, the window is made 1 px larger. The popup shows the size you set, and the image is trimmed on the right and bottom to that size. If you later change the window by 3 px or more by hand, the actual size is used.
- On high-density displays, the image still has the size you set (at 150%, a 960x720 capture is scaled down to 640x480), so some sharpness is lost.
- On macOS and ChromeOS, the window is not aligned and the size is changed only once.

### 3. Resizing a zoomed page
- The page zoom is not changed. Zoom does not affect the window or viewport size, so the size comes out as set while the page stays zoomed.
- The viewport size shown in the popup does not depend on the zoom level. A 1280x720 viewport is shown as 1280 x 720 at 150% or 80% zoom.
- A full-page image is as wide as the viewport and as tall as the zoomed page. Anything overflowing horizontally is not captured.

### 4. What the screenshots capture
- Both screenshot features ("Visible area" and "Full page") capture **only the web page content inside the tab (the viewport area)**.
- A "whole window screenshot" that includes the OS title bar, browser toolbar and window frame cannot be taken with Chrome's standard capture APIs, so please use an external capture tool.
- "Full page" also works on layouts where the page itself does not scroll and only an inner area does (common in business systems and admin dashboards). If a scrollable area covers at least 70% of the viewport, only its content is captured to the end and stitched vertically (if there are only smaller areas, nothing is extended and you get one screen of the visible area). When "Include the surrounding frame and the part below the area" is enabled in the settings, the frame of the first screen (header, sidebar, etc.) is kept and the part below the area is appended at the end. The sidebar is not extended, so it appears only for the first screen.
- The select button on the Full page row (enabled only on pages with a scrollable area) highlights the scrollable areas on the page, and you can save or copy the one you click. Press Esc to cancel. Copy is not offered on pages where the clipboard is unavailable, such as http pages. Areas inside cross-origin iframes and areas scrolled by custom JavaScript cannot be chosen.
- Choosing 3, 5 or 10 seconds with the timer in the screenshot section takes the screenshot that long after the download button is pressed. The popup closes right away, so you can interact with the page in the meantime to bring up hover menus and the like. The remaining seconds appear on the toolbar icon's badge. Copying and area selection are not available with the timer because the popup closes while waiting. If you switch to another tab while waiting, no screenshot is taken (shown with `!`). The timer choice stays until you set it back to "Off".
- When you press a download button, the popup closes right away and the result is shown as a badge on the toolbar icon (`...` while capturing, `OK` on success, `!` on failure). For copy, the popup closes after the image has been written to the clipboard.

### 5. Permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Script injection and screenshot capture for the active tab you interact with the extension on |
| `storage` | Saving settings and custom sizes (local/sync) |
| `downloads` | Saving screenshots into the `Captures` folder |
| `scripting` | Reading the display scale and display size (for shortcuts), and scroll control/measurement scripts for full-page screenshots |

`host_permissions` (`<all_urls>`), `tabs` and `system.display` are not used. The upper-limit check for custom sizes uses `window.screen` of the display where the popup is shown.

### 6. Store rating request
- From 3 days after installation, a successful resize or capture makes the popup show a request to rate the extension on the store and support development the next time it opens. It does not appear right after the success, so it never interrupts what you are doing.
- "Later" shows it again after 3 more days. "Don't show again" hides it until the next update (it comes back 3 days after the update). "Rate on the store" opens the store's review page, and it is not shown again, even after updates.
- The installation date and the state of the request are stored only in the browser (`chrome.storage.local`) and are never sent anywhere.

### 7. Keeping the window on screen
- When a resize would push the window off the screen, the requested size is kept and the window is moved just enough to stay on the screen. This applies to window-based and viewport-based resizing and to shortcuts. The reference is the work area (excluding the taskbar and so on) of the display the window is on, read from `window.screen` without the `system.display` permission.
- Sizes larger than the display cannot be selected. A preset or custom size that exceeds the display in either width or height is disabled, with the reason in its tooltip (shortcuts show `!`), because a window that goes off the screen may become impossible to operate. The comparison uses the size after display scaling, so a 1920x1080 monitor at 125% has a limit of 1536x864.
- Viewport-based sizes are compared with the window frame added. Window size has an upper limit (about the size of the screen with a single monitor), so a viewport the size of the screen, or one that leaves no room for the frame, cannot be made. On a 1920x1080 monitor at 100%, a viewport-based 1920x1080 cannot be selected.
- Which monitors are adjacent cannot be known without a permission, so even a size meant to span several monitors is kept on the current one. To span monitors, turn off "Move the window to keep it on screen" on the settings page.
- When a shortcut is used on a special page such as `chrome://`, the screen area cannot be read, so the window is not moved.

### 8. Keyboard shortcuts
- No keys are assigned by default, because they would collide with other extensions, Windows and Chrome. Open Chrome's shortcuts page (`chrome://extensions/shortcuts`) from "Keyboard shortcuts" on the settings page and assign only the ones you want. The current assignments are also shown on the settings page.
- Available commands: resizing to a preset (8), resizing to a custom size (5 slots), downloading and copying the visible area or the full page, choosing a scrollable area, and a delayed download of the visible area (3, 5 or 10 seconds). A delayed capture starts without leaving the page, so hover menus can stay open.
- Presets use the base (window or viewport) last selected in the popup. For custom sizes, choose a size for each slot on the settings page; it is applied with that size's own base. If a slot is empty, or its size was deleted, nothing is resized and a `!` badge and the icon's tooltip tell you so.
- The popup does not open, so results appear as a badge on the toolbar icon (success `OK` / failure `!`). On failure, the reason is shown in the icon's tooltip while the badge is visible.
- `activeTab` is also granted by a shortcut, so no extra permissions are needed. Scripts cannot be injected into special pages such as `chrome://`, so only downloading the visible area works there.
- Copying writes to the clipboard from the page, so it works only on `https` pages and `localhost`.

## Versioning and changelog

Because of a Plasmo constraint, the `version` field of `package.json` is managed strictly as three dot-separated integers (MAJOR.MINOR.PATCH) (current: `0.4.0`). Beta status is expressed in the distributable ZIP file name, the README and Git tags (for example, `window-resizer-screenshot-v0.2.1-beta.2.zip`).

| Version | Release date | Summary |
|---|---|---|
| 0.4.0 (beta.1) | 2026-10-31 | Resizing a page whose zoom is not 100% no longer ends up at an unintended size (after confirmation, the zoom is reset to 100% before resizing). Added the "Ask for confirmation before resetting the zoom" setting (on by default). Made the toolbar icon color stronger because it was faint in light mode |
| 0.3.0 (beta.1) | 2026-10-31 | Fixed full-page screenshots stopping after one screen on pages where the page itself does not scroll and only an inner area does (a scrollable area covering at least 70% of the viewport is detected automatically and captured to the end). Added the "Include the surrounding frame and the part below the area" setting. Added choosing a scrollable area on the page to download or copy. The popup now closes as soon as you press a download button, and the result is shown as a badge on the toolbar icon (`...` / `OK` / `!`). Copy now closes the popup after it completes. Fixed a scrollbar appearing in the popup in Japanese |
| 0.2.1 (beta.2) | 2026-10-21 | The distribution ZIP now includes the Tabler Icons MIT license (`licenses/LICENSE-tabler.txt`). Added `scripts/copy-license.mjs`, which copies it automatically on build / package |
| 0.2.1 (beta.1) | 2026-10-20 | Fixed a display issue where the icons on the screenshot, settings and Share on X buttons overflowed their frames and were clipped. The last selected size basis (Window-based / Viewport-based) is now remembered when the popup is reopened. The Open settings and Share on X buttons now share the same design, are centered and sit closer together. The Open settings icon is now a Tabler Icons gear |
| 0.2.0 (beta.1) | 2026-10-20 | Added PNG and WebP screenshot formats (PNG is the default and can be changed in the settings; JPEG is still available). Added copying to the clipboard (PNG). Redesigned the screenshot section with Tabler Icons buttons (Visible area / Full page rows x Download / Copy), showing a check icon for 1.5 seconds after copying. Added a Share on X button. Tightened the popup spacing to reduce its height. Added the Tabler Icons (MIT License) credit to the settings page |
| 0.1.1 (beta.1) | 2026-10-04 | Minimized permissions. Removed `host_permissions` (`<all_urls>`), `tabs` and `system.display`; the extension now works with only `activeTab`, `scripting`, `storage` and `downloads`. The upper-limit check for sizes now uses `window.screen` |
| 0.1.0 (beta.1) | 2026-10-03 | First release of the 0.1.0 beta. Includes window/viewport resizing (16:9 and 4:3 resolution templates, per-template offsets, adding/editing/deleting custom sizes), visible-area / full-page (scrolling capture + stitching) screenshots saved as JPG into the `Captures` folder, local/sync storage switching, factory reset, multilingual UI (Japanese / English) and dark mode support |

---

## License and usage of the source code

- The source code in this repository is published solely as a reference for the explanations and learning material in the accompanying technical blog.
- **Commercial use is prohibited.**
- **Redistribution and resale are prohibited.** Redistributing, publishing or selling this source code, either as-is or with modifications, on the Chrome Web Store or any similar platform is strictly prohibited.
- Free use within the scope of personal use is permitted.


---

## Third-party

- Icons: [Tabler Icons](https://tabler.io/icons) (MIT License). Only the required SVGs are bundled in `icons/`; the full license text is in `licenses/LICENSE-tabler.txt`, and `scripts/copy-license.mjs` copies it into the build output at build time, so it is also included in the distribution ZIP as `licenses/LICENSE-tabler.txt`.

---

## Support the project

If you find this extension useful, you can treat me to a drink to support development.

<a href="https://www.buymeacoffee.com/uc4696" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-blue.png" alt="Buy Me a Coffee" style="height: 60px !important;width: 217px !important;" ></a>
