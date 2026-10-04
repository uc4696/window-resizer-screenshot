# Window & Viewport Resizer (Chrome extension)

[日本語](README.md) | **English**

> **Current version: `0.1.0` (beta `0.1.0-beta.1`)**

A Chrome extension (Manifest V3 / Plasmo framework) that resizes the window or viewport to a preset or custom size, and captures screenshots of the visible area or the full page and downloads them.

## Overview

- Resizing for both window size and viewport size
- Resolution templates grouped by aspect ratio (16:9: HD/FHD/WQHD/4K, 4:3: VGA/SVGA/XGA/UXGA)
- Per-template, per-mode (window-based / viewport-based) offset (margin) values configurable on the Options page
- Add, edit and delete custom sizes (a correction offset can be specified in window-based mode). The list is always shown right below the templates, and the "Custom size settings" accordion only contains the add/edit form
- Popup UI opened from the toolbar icon (automatic dark mode support)
- Screenshots of the visible tab or the full page (scrolling capture + stitching)
- Saved as JPG into the `Captures` folder under Downloads (the folder name can be changed)
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
│   └── generate-icon.js            # Generates icons of each size from icon-source.png (uses sharp)
├── src/
│   ├── popup.tsx                   # Popup UI (template selection, custom sizes, screenshot buttons)
│   ├── style.css                   # Popup styles (dark mode supported)
│   ├── options.tsx                 # Options page
│   ├── options.css                 # Options page styles (dark mode supported)
│   ├── background.ts               # Screenshot capture and download handling (service worker)
│   ├── components/
│   │   ├── PresetGrid.tsx          # Template size buttons
│   │   ├── CustomSizeList.tsx      # Saved custom sizes: apply / edit / delete UI
│   │   ├── CustomSizeManager.tsx   # Add/edit form for custom sizes (accordion)
│   │   └── SupportLink.tsx         # Support link
│   └── lib/
│       ├── types.ts                # Type definitions
│       ├── constants.ts            # Default templates, storage keys and other constants
│       ├── storage.ts              # Settings/data management with local/sync switching
│       ├── offset.ts               # Offset (correction value) calculation
│       ├── resize.ts               # Window / viewport resizing and validation
│       ├── screenshot.ts           # Visible Tab / Full Page screenshot capture
│       ├── filename.ts             # Saved file name and path construction
│       ├── messages.ts             # Message types between popup and background
│       └── i18n/                   # Internationalization (messages.en.ts / messages.ja.ts / index.ts / useI18n.tsx)
├── package.json                    # Dependencies and manifest settings (permissions, etc.)
├── tsconfig.json                   # TypeScript settings (alias ~* -> ./src/*)
├── Cline_WORKFLOW.md               # App-specific development rules
├── README.md / README.en.md        # Documentation (Japanese / English)
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

  This generates `build/chrome-mv3-prod.zip`. When distributing a beta version, rename the file, for example to `window-resizer-screenshot-v0.1.1-beta.1.zip` (see `Cline_WORKFLOW.md` for the naming rules).

## Specifications and limitations

### 1. Window-based resizing and measured size (OS differences / invisible borders)
- **Background**: On Windows (DWM: Desktop Window Manager), windows have invisible transparent borders (a few px on the left, right and bottom) for resizing. Display scaling (100% / 125% / 150%, etc.) can also cause pixel differences.
- **Symptom**: Even if you specify `1920x1080` through `chrome.windows.update`, the outer window size measured by OS screenshots or external capture tools may be a few pixels smaller (or larger), for example `1906x1073`. This difference cannot be detected from Chrome extension APIs.
- **Approach**:
  - **Templates**: Applied as-is (no offset) to stay independent of the environment.
  - **Custom sizes (offset feature)**: To make the measured outer window size match the target size in your OS/scaling environment, specify a "size correction offset" (width/height correction in px) when adding or editing a custom size. For example, if the measured width is 14px smaller and the height 7px smaller, register `+14` / `+7` as the offset.

### 2. Viewport-based resizing limitation (does not work on special pages)
- Accurately measuring the viewport (page display area) requires running a script in the active tab (`chrome.scripting.executeScript`).
- Because of Chrome's security policy, script injection is blocked on special pages such as `chrome://` (settings, extensions list, etc.), `chrome-extension://`, `edge://` and the Chrome Web Store.
- If you run a viewport-based resize while such a page is active, a guidance error message is shown and the resize is aborted. Use a tab with a regular web page (`https://` or `http://`).

### 3. What the screenshots capture
- Both screenshot features ("Capture visible area" and "Capture full page") capture **only the web page content inside the tab (the viewport area)**.
- A "whole window screenshot" that includes the OS title bar, browser toolbar and window frame cannot be taken with Chrome's standard capture APIs, so please use an external capture tool.

### 4. Permissions

| Permission | Purpose |
|---|---|
| `activeTab` | Script injection and screenshot capture for the active tab you interact with the extension on |
| `storage` | Saving settings and custom sizes (local/sync) |
| `downloads` | Saving screenshots into the `Captures` folder |
| `scripting` | Measuring the viewport, and scroll control/measurement scripts for full-page screenshots |

`host_permissions` (`<all_urls>`), `tabs` and `system.display` are not used. The upper-limit check for custom sizes uses `window.screen` of the display where the popup is shown.

## Versioning and changelog

Because of a Plasmo constraint, the `version` field of `package.json` is managed strictly as three dot-separated integers (MAJOR.MINOR.PATCH) (current: `0.1.1`). Beta status is expressed in the distributable ZIP file name, the README and Git tags (for example, `window-resizer-screenshot-v0.1.1-beta.1.zip`).

| Version | Release date | Summary |
|---|---|---|
| 0.1.1 (beta.1) | 2026-10-04 | Minimized permissions. Removed `host_permissions` (`<all_urls>`), `tabs` and `system.display`; the extension now works with only `activeTab`, `scripting`, `storage` and `downloads`. The upper-limit check for sizes now uses `window.screen` |
| 0.1.0 (beta.1) | 2026-10-03 | First release of the 0.1.0 beta. Includes window/viewport resizing (16:9 and 4:3 resolution templates, per-template offsets, adding/editing/deleting custom sizes), visible-area / full-page (scrolling capture + stitching) screenshots saved as JPG into the `Captures` folder, local/sync storage switching, factory reset, multilingual UI (Japanese / English) and dark mode support |

---

## License and usage of the source code

- The source code in this repository is published solely as a reference for the explanations and learning material in the accompanying technical blog.
- **Commercial use is prohibited.**
- **Redistribution and resale are prohibited.** Redistributing, publishing or selling this source code, either as-is or with modifications, on the Chrome Web Store or any similar platform is strictly prohibited.
- Free use within the scope of personal use is permitted.

