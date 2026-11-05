/**
 * 英語メッセージ辞書（キーの型の基準）。
 * 新しい文言を追加する場合はここにキーを追加し、messages.ja.ts にも同じキーを追加する
 * （追加漏れは型チェックで検出される）。
 * プレースホルダーは {name} 形式。
 */
export const en = {
  // ---- popup ----
  currentWindowSize: "Current window size",
  currentViewportSize: "Current viewport size (the area that shows the page)",
  modeWindow: "Window-based",
  modeViewport: "Viewport-based",
  modeWindowShort: "Window",
  modeViewportShort: "Viewport",
  modeWindowTitle: "The chosen size applies to the whole window, including the toolbar",
  modeViewportTitle: "The chosen size applies to the area that shows the page",
  screenshotTitle: "Screenshot",
  captureVisibleLabel: "Visible area",
  captureFullPageLabel: "Full page",
  captureVisibleDownload: "Download screenshot of visible area",
  captureVisibleCopy: "Copy screenshot of visible area to clipboard",
  captureFullPageDownload: "Download screenshot of full page",
  captureFullPageCopy: "Copy screenshot of full page to clipboard",
  captureDelayTitle: "Timer",
  captureDelayLabel:
    "Timer: captures a few seconds after you press download, so you can open a menu first",
  captureDelayNone: "Off",
  captureDelaySeconds: "{seconds}s",
  captureNoCopyWithDelay:
    "Copying and choosing an area are not available with the timer. The popup closes while waiting, so the screenshot can only be downloaded.",
  capturePick: "Capture all of a section that scrolls on its own, such as a list",
  capturePickUnavailable: "This page has no section that scrolls on its own",
  pickerBanner: "Click the area to capture (Esc to cancel)",
  pickerContent: "content {height}px",
  pickerSave: "Download",
  pickerCopy: "Copy",
  pickerCancel: "Cancel",
  statusCopied: "Copied to clipboard.",
  errClipboard: "Failed to copy to the clipboard.",
  openSettings: "Open settings (language, theme, save folder and more)",
  shareOnTitle: "Share this extension on {name} (opens the post screen)",
  shareText:
    "Check how your page looks at any size, instantly.\nResize the window/viewport and capture full-page screenshots, all in one extension 📸",
  shareHashtags: "#ChromeExtension #WebDev",
  statusResized: "Resized to {width} x {height}.",
  statusError: "Error: {message}",
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
  customToggleClose: "Close the form",
  customToggleOpen: "Add a custom size",
  customDefaultName: "Custom {n}",
  useCurrentSize: "Use current size",
  formTitleEdit: "Edit custom size",
  formTitleAdd: "Add custom size",
  namePlaceholder: "Name (optional)",
  widthPlaceholder: "Width",
  heightPlaceholder: "Height",
  offsetLabel: "Size correction offset (optional, px):",
  offsetWidthPlaceholder: "Width offset",
  offsetHeightPlaceholder: "Height offset",
  offsetHint: "Fixes gaps from invisible OS or DPI borders",
  displayHint: "Display: {width} x {height} (the maximum)",
  update: "Update",
  add: "Add",
  cancel: "Cancel",

  // ---- review prompt ----
  reviewPromptTitle: "Is Window & Viewport Resizer helpful?",
  reviewPromptBody: "Rate it on the Chrome Web Store.",
  reviewPromptSupport: "Buy me a drink!",
  reviewPromptRate: "Rate on the store",
  reviewPromptLater: "Later",
  reviewPromptNever: "Don't show again",

  // ---- support link ----
  supportText: "Buy me a drink to support development",

  // ---- options ----
  loading: "Loading...",
  optionsTitle: "Window & Viewport Resizer - Settings",
  languageLabel: "Language",
  languageHint:
    'Choose the display language. "Auto" follows the browser language (English if unsupported).',
  languageAuto: "Auto",
  themeLabel: "Theme",
  themeHint: "Choose the colors of the popup and this page.",
  themeAuto: "Follow the browser",
  themeLight: "Light",
  themeDark: "Dark",
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
  keepOnScreenLabel: "Keeping the window on screen",
  keepOnScreenHint:
    "When a resize would push the window off the screen, it is moved just enough to stay on the screen; the size does not change. A window larger than the screen is aligned to the top right so the toolbar icons stay reachable. Turn this off if you want a window to span several monitors.",
  keepOnScreenCheckbox: "Move the window to keep it on screen",
  shortcutsLabel: "Keyboard shortcuts",
  shortcutsHint:
    "No keys are assigned by default. Assign only the ones you want on Chrome's shortcuts page. Presets use the base (window or viewport) last selected in the popup; custom sizes use their own. Results appear on the toolbar icon. Copying works only on https pages and localhost. On special pages such as chrome://, only downloading the visible area works.",
  shortcutsOpen: "Open Chrome's shortcuts page",
  shortcutsNotSet: "Not set",
  shortcutsSlotHint:
    "Choose which custom size each slot applies. An empty slot does nothing.",
  shortcutsSlotEmpty: "(Empty)",
  storageLabel: "Storage area (where custom sizes are saved)",
  storageHint:
    "local: saved on this device only. sync: tied to your Google account and synced across devices.",
  storageLocalDefault: "local (default)",
  settingsSaved: "Settings saved.",
  presetOffsetLabel: "Resolution template offsets (margins)",
  presetOffsetHint:
    "You can set separate correction values (px) for each preset in window-based and viewport-based modes. Leaving both fields empty removes the correction for that mode.",
  offsetWidthShort: "Width offset",
  offsetHeightShort: "Height offset",
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
  errViewportUnavailable: "Could not get the viewport size.",
  errPageSize: "Failed to get the page size.",
  errPageTooLarge:
    "The page is too large to generate a full-page screenshot ({width}x{height}).",
  errCanvas: "Failed to create the canvas context.",
  errShortcutSlotEmpty:
    "No size is assigned to custom size {slot}. Choose one in the extension settings.",
  errShortcutPresetUnknown: "The preset for this shortcut was not found.",
  errClipboardUnavailable:
    "Copying is not available on this page (https or localhost only).",
  errBoundsRejected:
    "Chrome does not allow a {width} x {height} window on this screen, because at least half of the window must be on screen.",
  errDelayTabChanged:
    "The screenshot was not taken because the tab was switched during the timer.",
  sizeOverDisplay: "Larger than this display ({width} x {height})",
  errPickedAreaMissing: "The selected area was not found. Please choose it again."
}

export type MessageKey = keyof typeof en
