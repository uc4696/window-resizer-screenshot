/**
 * 英語メッセージ辞書（キーの型の基準）。
 * 新しい文言を追加する場合はここにキーを追加し、messages.ja.ts にも同じキーを追加する
 * （追加漏れは型チェックで検出される）。
 * プレースホルダーは {name} 形式。
 */
export const en = {
  // ---- popup ----
  windowLabel: "Window:",
  viewportLabel: "Viewport:",
  modeWindow: "Window-based",
  modeViewport: "Viewport-based",
  screenshotTitle: "Screenshot",
  captureVisible: "Capture visible area",
  captureFullPage: "Capture full page",
  openSettings: "⚙ Open settings",
  statusResized: "Resized to {width} x {height}.",
  statusError: "Error: {message}",
  statusCapturingFullPage: "Capturing full page...",
  statusCapturing: "Capturing...",
  statusSaved: "Saved: {filename}",
  errCaptureFailed: "Failed to capture the screenshot.",

  // ---- preset groups / badges ----
  presetGroup169: "16:9 (Widescreen)",
  presetGroup43: "4:3 (Standard)",
  offsetBadge: "Offset",

  // ---- custom size list ----
  customSizes: "Custom sizes",
  offsetTooltip: "(Offset: {w} / {h}px)",
  offsetBadgeTitle: "Correction applied on resize",
  edit: "Edit",
  delete: "Delete",

  // ---- custom size manager ----
  customToggleClose: "▲ Close custom size settings",
  customToggleOpen: "▼ Custom size settings",
  formTitleEdit: "Edit custom size",
  formTitleAdd: "Add custom size",
  namePlaceholder: "Name (optional)",
  widthPlaceholder: "Width",
  heightPlaceholder: "Height",
  offsetLabel: "Size correction offset (optional, px):",
  offsetWidthPlaceholder: "Width offset (e.g. 14)",
  offsetHeightPlaceholder: "Height offset (e.g. 7)",
  offsetHint:
    "Correction added when the size is off because of invisible borders caused by the OS or DPI",
  displayHint: "Current display: {width} x {height} (specify within this range)",
  update: "Update",
  add: "Add",
  cancel: "Cancel",

  // ---- support link ----
  supportText: "Buy me a drink to support development",

  // ---- options ----
  loading: "Loading...",
  optionsTitle: "Window & Viewport Resizer - Settings",
  languageLabel: "Language",
  languageHint:
    "Choose the display language. \"Auto\" follows the browser language (English if unsupported).",
  languageAuto: "Auto",
  captureDirLabel: "Screenshot save folder name",
  captureDirHint:
    "Name of the folder created under your Downloads folder (e.g. Downloads/Captures/...).",
  storageLabel: "Storage area (where custom sizes are saved)",
  storageHint:
    "local: saved on this device only. sync: tied to your Google account and synced across devices.",
  storageLocalDefault: "local (default)",
  save: "Save",
  settingsSaved: "Settings saved.",
  presetOffsetLabel: "Resolution template offsets (margins)",
  presetOffsetHint:
    "You can set separate correction values (px) for each preset in window-based and viewport-based modes. Saving with both fields empty removes the correction for that mode.",
  offsetWidthShort: "Width offset",
  offsetHeightShort: "Height offset",
  clear: "Clear",
  resetLabel: "Factory reset (initialize settings)",
  resetHint:
    "Restores the save folder name, storage area, language, custom sizes and preset offsets to their defaults.",
  resetButton: "Reset settings",
  resetDone: "Settings have been reset.",
  resetConfirm:
    "This resets all settings, custom sizes and preset offsets to their defaults. This cannot be undone. Continue?",

  // ---- validation / errors ----
  errInvalidInput: "Invalid input.",
  errInvalidOffset: "Invalid offset value.",
  errSizeNumeric: "Width and height must be numbers.",
  errSizeInteger: "Width and height must be integers.",
  errSizeMin: "Width and height must be at least {min}px.",
  errSizeMax:
    "Width and height must not exceed the current display resolution ({width}x{height}).",
  errOffsetNumeric: "Offset values must be numbers.",
  errOffsetInteger: "Offset values must be integers.",
  errOffsetRange: "Offset values must be between -500px and 500px.",
  errWindowInfo: "Could not get the current window information.",
  errNoActiveTab: "No active tab was found.",
  errRestrictedPage:
    "Due to Chrome restrictions, the viewport size cannot be read on special pages (such as chrome://). Please run this on a regular web page.",
  errViewportFailed: "Failed to get the viewport size: {message}",
  errViewportUnavailable: "Could not get the viewport size.",
  errPageSize: "Failed to get the page size.",
  errPageTooLarge:
    "The page is too large to generate a full-page screenshot ({width}x{height}).",
  errCanvas: "Failed to create the canvas context."
}

export type MessageKey = keyof typeof en
