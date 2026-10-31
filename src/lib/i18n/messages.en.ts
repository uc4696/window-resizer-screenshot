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
  captureVisibleLabel: "Visible area",
  captureFullPageLabel: "Full page",
  captureVisibleDownload: "Download screenshot of visible area",
  captureVisibleCopy: "Copy screenshot of visible area to clipboard",
  captureFullPageDownload: "Download screenshot of full page",
  captureFullPageCopy: "Copy screenshot of full page to clipboard",
  capturePick: "Choose a scrollable area to capture",
  capturePickUnavailable: "There is no scrollable area to choose on this page",
  pickerBanner: "Click the area to capture (Esc to cancel)",
  pickerContent: "content {height}px",
  pickerSave: "Download",
  pickerCopy: "Copy",
  pickerCancel: "Cancel",
  statusCopied: "Copied to clipboard.",
  errClipboard: "Failed to copy to the clipboard.",
  openSettings: "Open settings",
  shareOnX: "Share on X",
  shareOnXTitle: "Share this extension on X (opens the post screen)",
  shareText:
    "Check how your page looks at any size, instantly.\nResize the window/viewport and capture full-page screenshots, all in one extension 📸",
  shareHashtags: "#ChromeExtension #WebDev",
  statusResized: "Resized to {width} x {height}.",
  statusError: "Error: {message}",
  zoomConfirmMessage:
    "This page is zoomed to {zoom}%. The size will not match as intended, so the zoom will be reset to 100% before resizing.",
  zoomConfirmOk: "Reset to 100% and resize",
  statusCapturingFullPage: "Capturing full page...",
  statusCapturing: "Capturing...",
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
    'Choose the display language. "Auto" follows the browser language (English if unsupported).',
  languageAuto: "Auto",
  captureDirLabel: "Screenshot save folder name",
  captureDirHint:
    "Name of the folder created under your Downloads folder (e.g. Downloads/Captures/...).",
  imageFormatLabel: "Default screenshot format",
  imageFormatHint:
    "Format used when downloading screenshots. Copying to the clipboard always uses PNG.",
  scrollAreaFrameLabel: "Capturing a scrollable area",
  scrollAreaFrameHint:
    "On pages where only an inner area scrolls, the full-page screenshot captures just that area. When enabled, the surrounding frame of the first screen (header, sidebar, etc.) is kept and the part below the area is appended at the end. The sidebar is not extended, so it appears only for the first screen.",
  scrollAreaFrameCheckbox: "Include the surrounding frame and the part below the area",
  zoomResetLabel: "Resizing a zoomed page",
  zoomResetHint:
    "When the page is not at 100% zoom, the zoom is reset to 100% before resizing so the size comes out as intended.",
  zoomResetConfirmCheckbox: "Ask for confirmation before resetting the zoom",
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
    "Restores the save folder name, screenshot format, scrollable area capture setting, storage area, language, custom sizes and preset offsets to their defaults.",
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
  errCanvas: "Failed to create the canvas context.",
  errPickedAreaMissing: "The selected area was not found. Please choose it again."
}

export type MessageKey = keyof typeof en
