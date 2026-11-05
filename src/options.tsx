import { useEffect, useState } from "react"

import { SupportLink } from "~components/SupportLink"
import { COMMAND_NAMES, parseCommand } from "~lib/commands"
import { DEFAULT_SETTINGS, IMAGE_FORMATS, PRESET_GROUPS } from "~lib/constants"
import { LANGUAGE_NATIVE_NAMES, setLanguage } from "~lib/i18n"
import { I18nProvider, useI18n } from "~lib/i18n/useI18n"
import { validateOffset } from "~lib/resize"
import {
  getCustomSizes,
  getPresetOffsets,
  getSettings,
  migrateCustomSizes,
  removePresetOffset,
  resetAllSettings,
  setPresetOffset,
  setSettings,
  type Settings
} from "~lib/storage"
import type {
  CustomSize,
  ImageFormat,
  LanguageSetting,
  PresetModeOffsets,
  SizeMode
} from "~lib/types"

import "./options.css"

const OFFSET_MODES: { mode: SizeMode; labelKey: "modeWindow" | "modeViewport" }[] = [
  { mode: "window", labelKey: "modeWindow" },
  { mode: "viewport", labelKey: "modeViewport" }
]

/** オフセット入力・エラー状態のキー（プリセットID × モード）。 */
function offsetKey(presetId: string, mode: SizeMode): string {
  return `${presetId}:${mode}`
}

function OptionsContent() {
  const { t } = useI18n()
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [presetOffsets, setPresetOffsets] = useState<Record<string, PresetModeOffsets>>(
    {}
  )
  const [offsetInputs, setOffsetInputs] = useState<
    Record<string, { w: string; h: string }>
  >({})
  const [offsetErrors, setOffsetErrors] = useState<Record<string, string>>({})
  const [resetDone, setResetDone] = useState(false)
  const [commands, setCommands] = useState<chrome.commands.Command[]>([])
  const [customSizes, setCustomSizes] = useState<CustomSize[]>([])

  // ショートカットの割り当ては Chrome の画面で変えるので、戻ってきたときに読み直す
  useEffect(() => {
    const refresh = () => {
      chrome.commands.getAll().then(setCommands)
      getCustomSizes().then(setCustomSizes)
    }
    refresh()
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [])

  useEffect(() => {
    Promise.all([getSettings(), getPresetOffsets()]).then(([s, offsets]) => {
      setSettingsState(s)
      setPresetOffsets(offsets)
      const inputs: Record<string, { w: string; h: string }> = {}
      for (const preset of PRESET_GROUPS.flatMap((g) => g.presets)) {
        for (const { mode } of OFFSET_MODES) {
          const o = offsets[preset.id]?.[mode]
          inputs[offsetKey(preset.id, mode)] = {
            w: o ? String(o.offsetWidth) : "",
            h: o ? String(o.offsetHeight) : ""
          }
        }
      }
      setOffsetInputs(inputs)
      setLoading(false)
    })
  }, [])

  async function handleSave(next: Settings) {
    setSaved(false)
    const prevArea = settings.storageArea
    await setSettings(next)
    if (prevArea !== next.storageArea) {
      await migrateCustomSizes(prevArea, next.storageArea)
    }
    setSettingsState(next)
    setLanguage(next.language)
    setSaved(true)
  }

  /** 言語は選択した時点で保存・反映する（他の設定は「保存」ボタンで保存）。 */
  async function handleLanguageChange(language: LanguageSetting) {
    await handleSave({ ...settings, language })
  }

  /** 画像形式は選択した時点で保存・反映する。 */
  async function handleImageFormatChange(imageFormat: ImageFormat) {
    // 選択の見た目は即時に反映し、保存は続けて行う
    const next = { ...settings, imageFormat }
    setSettingsState(next)
    await handleSave(next)
  }

  /** スクロール範囲の撮影設定は切り替えた時点で保存・反映する。 */
  async function handleIncludeFrameChange(scrollAreaIncludeFrame: boolean) {
    const next = { ...settings, scrollAreaIncludeFrame }
    setSettingsState(next)
    await handleSave(next)
  }

  /** 拡大率リセットの確認設定は切り替えた時点で保存・反映する。 */
  async function handleZoomResetConfirmChange(zoomResetConfirm: boolean) {
    const next = { ...settings, zoomResetConfirm }
    setSettingsState(next)
    await handleSave(next)
  }

  /** 画面内に収める設定は切り替えた時点で保存・反映する。 */
  async function handleKeepOnScreenChange(keepWindowOnScreen: boolean) {
    const next = { ...settings, keepWindowOnScreen }
    setSettingsState(next)
    await handleSave(next)
  }

  /** ショートカットの枠のカスタムサイズは選んだ時点で保存する。 */
  async function handleSlotChange(slot: number, id: string) {
    const customSizeSlots = settings.customSizeSlots.map((current, i) =>
      i === slot - 1 ? id : current
    )
    const next = { ...settings, customSizeSlots }
    setSettingsState(next)
    await handleSave(next)
  }

  async function handleSaveOffset(presetId: string, mode: SizeMode) {
    const key = offsetKey(presetId, mode)
    const input = offsetInputs[key] ?? { w: "", h: "" }
    setOffsetErrors((prev) => ({ ...prev, [key]: "" }))

    if (input.w.trim() === "" && input.h.trim() === "") {
      const next = await removePresetOffset(presetId, mode)
      setPresetOffsets(next)
      return
    }

    const w = Number(input.w.trim() === "" ? 0 : input.w)
    const h = Number(input.h.trim() === "" ? 0 : input.h)
    const result = validateOffset(w, h)
    if (!result.valid) {
      setOffsetErrors((prev) => ({
        ...prev,
        [key]: result.error ?? t("errInvalidInput")
      }))
      return
    }

    const next = await setPresetOffset(presetId, mode, {
      offsetWidth: w,
      offsetHeight: h
    })
    setPresetOffsets(next)
  }

  async function handleClearOffset(presetId: string, mode: SizeMode) {
    const key = offsetKey(presetId, mode)
    const next = await removePresetOffset(presetId, mode)
    setPresetOffsets(next)
    setOffsetInputs((prev) => ({ ...prev, [key]: { w: "", h: "" } }))
    setOffsetErrors((prev) => ({ ...prev, [key]: "" }))
  }

  async function handleFactoryReset() {
    const confirmed = window.confirm(t("resetConfirm"))
    if (!confirmed) return

    await resetAllSettings()
    const [s, offsets] = await Promise.all([getSettings(), getPresetOffsets()])
    setSettingsState(s)
    setLanguage(s.language)
    setPresetOffsets(offsets)
    setOffsetInputs({})
    setOffsetErrors({})
    setResetDone(true)
    setSaved(false)
  }

  if (loading) {
    return (
      <main className="options-root">
        <p>{t("loading")}</p>
      </main>
    )
  }

  return (
    <main className="options-root">
      <h1 className="options-title">{t("optionsTitle")}</h1>

      <section className="options-section">
        <label className="options-label" htmlFor="language">
          {t("languageLabel")}
        </label>
        <p className="options-hint">{t("languageHint")}</p>
        <select
          id="language"
          className="options-input"
          value={settings.language}
          onChange={(e) => handleLanguageChange(e.target.value as LanguageSetting)}
        >
          <option value="auto">{t("languageAuto")}</option>
          <option value="ja">{LANGUAGE_NATIVE_NAMES.ja}</option>
          <option value="en">{LANGUAGE_NATIVE_NAMES.en}</option>
        </select>
      </section>

      <section className="options-section">
        <label className="options-label" htmlFor="captureDirName">
          {t("captureDirLabel")}
        </label>
        <p className="options-hint">{t("captureDirHint")}</p>
        <input
          id="captureDirName"
          className="options-input"
          type="text"
          value={settings.captureDirName}
          onChange={(e) =>
            setSettingsState({ ...settings, captureDirName: e.target.value })
          }
        />
      </section>

      <section className="options-section">
        <label className="options-label">{t("imageFormatLabel")}</label>
        <p className="options-hint">{t("imageFormatHint")}</p>
        <div className="options-radio-group">
          {IMAGE_FORMATS.map((format) => (
            <label key={format} className="options-radio">
              <input
                type="radio"
                name="imageFormat"
                value={format}
                checked={settings.imageFormat === format}
                onChange={() => handleImageFormatChange(format)}
              />
              {format === "jpeg" ? "JPEG" : format === "webp" ? "WebP" : "PNG"}
            </label>
          ))}
        </div>
      </section>

      <section className="options-section">
        <label className="options-label">{t("scrollAreaFrameLabel")}</label>
        <p className="options-hint">{t("scrollAreaFrameHint")}</p>
        <label className="options-radio">
          <input
            id="scrollAreaIncludeFrame"
            type="checkbox"
            checked={settings.scrollAreaIncludeFrame}
            onChange={(e) => handleIncludeFrameChange(e.target.checked)}
          />
          {t("scrollAreaFrameCheckbox")}
        </label>
      </section>

      <section className="options-section">
        <label className="options-label">{t("zoomResetLabel")}</label>
        <p className="options-hint">{t("zoomResetHint")}</p>
        <label className="options-radio">
          <input
            id="zoomResetConfirm"
            type="checkbox"
            checked={settings.zoomResetConfirm}
            onChange={(e) => handleZoomResetConfirmChange(e.target.checked)}
          />
          {t("zoomResetConfirmCheckbox")}
        </label>
      </section>

      <section className="options-section">
        <label className="options-label">{t("keepOnScreenLabel")}</label>
        <p className="options-hint">{t("keepOnScreenHint")}</p>
        <label className="options-radio">
          <input
            id="keepWindowOnScreen"
            type="checkbox"
            checked={settings.keepWindowOnScreen}
            onChange={(e) => handleKeepOnScreenChange(e.target.checked)}
          />
          {t("keepOnScreenCheckbox")}
        </label>
      </section>

      <section className="options-section" id="shortcuts">
        <label className="options-label">{t("shortcutsLabel")}</label>
        <p className="options-hint">{t("shortcutsHint")}</p>
        <button
          type="button"
          className="offset-preset-save"
          onClick={() => chrome.tabs.create({ url: "chrome://extensions/shortcuts" })}
        >
          {t("shortcutsOpen")}
        </button>
        <p className="options-hint shortcuts-slot-hint">{t("shortcutsSlotHint")}</p>
        <div className="shortcut-list">
          {COMMAND_NAMES.map((name) => {
            const command = commands.find((c) => c.name === name)
            const parsed = parseCommand(name)
            const slot = parsed?.kind === "resize-custom" ? parsed.slot : null
            return (
              <div key={name} className="shortcut-row" data-command={name}>
                <span className="shortcut-name">{command?.description ?? name}</span>
                {slot !== null && (
                  <select
                    className="shortcut-slot-select"
                    aria-label={command?.description ?? name}
                    value={
                      customSizes.some((s) => s.id === settings.customSizeSlots[slot - 1])
                        ? settings.customSizeSlots[slot - 1]
                        : ""
                    }
                    onChange={(e) => handleSlotChange(slot, e.target.value)}
                  >
                    <option value="">{t("shortcutsSlotEmpty")}</option>
                    {customSizes.map((size) => (
                      <option key={size.id} value={size.id}>
                        {size.label} ({size.width} x {size.height},{" "}
                        {t(size.mode === "window" ? "modeWindow" : "modeViewport")})
                      </option>
                    ))}
                  </select>
                )}
                {command?.shortcut ? (
                  <kbd className="shortcut-key">{command.shortcut}</kbd>
                ) : (
                  <span className="shortcut-unset">{t("shortcutsNotSet")}</span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="options-section">
        <label className="options-label">{t("storageLabel")}</label>
        <p className="options-hint">{t("storageHint")}</p>
        <div className="options-radio-group">
          <label className="options-radio">
            <input
              type="radio"
              name="storageArea"
              value="local"
              checked={settings.storageArea === "local"}
              onChange={() => setSettingsState({ ...settings, storageArea: "local" })}
            />
            {t("storageLocalDefault")}
          </label>
          <label className="options-radio">
            <input
              type="radio"
              name="storageArea"
              value="sync"
              checked={settings.storageArea === "sync"}
              onChange={() => setSettingsState({ ...settings, storageArea: "sync" })}
            />
            sync
          </label>
        </div>
      </section>

      <button className="options-save-button" onClick={() => handleSave(settings)}>
        {t("save")}
      </button>

      {saved && <p className="options-saved-text">{t("settingsSaved")}</p>}

      <section className="options-section">
        <label className="options-label">{t("presetOffsetLabel")}</label>
        <p className="options-hint">{t("presetOffsetHint")}</p>
        {PRESET_GROUPS.map((group) => (
          <div key={group.id} className="offset-preset-group">
            <p className="offset-preset-group-title">{t(group.labelKey)}</p>
            {group.presets.map((preset) => (
              <div key={preset.id} className="offset-preset-item">
                <span className="offset-preset-name">{preset.label}</span>
                {OFFSET_MODES.map(({ mode, labelKey }) => {
                  const key = offsetKey(preset.id, mode)
                  return (
                    <div key={key} className="offset-preset-row">
                      <span className="offset-preset-mode">{t(labelKey)}</span>
                      <input
                        className="text-input wh-input"
                        type="number"
                        placeholder={t("offsetWidthShort")}
                        value={offsetInputs[key]?.w ?? ""}
                        onChange={(e) =>
                          setOffsetInputs((prev) => ({
                            ...prev,
                            [key]: {
                              ...(prev[key] ?? { w: "", h: "" }),
                              w: e.target.value
                            }
                          }))
                        }
                      />
                      <input
                        className="text-input wh-input"
                        type="number"
                        placeholder={t("offsetHeightShort")}
                        value={offsetInputs[key]?.h ?? ""}
                        onChange={(e) =>
                          setOffsetInputs((prev) => ({
                            ...prev,
                            [key]: {
                              ...(prev[key] ?? { w: "", h: "" }),
                              h: e.target.value
                            }
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="offset-preset-save"
                        onClick={() => handleSaveOffset(preset.id, mode)}
                      >
                        {t("save")}
                      </button>
                      {presetOffsets[preset.id]?.[mode] && (
                        <button
                          type="button"
                          className="offset-preset-clear"
                          onClick={() => handleClearOffset(preset.id, mode)}
                        >
                          {t("clear")}
                        </button>
                      )}
                    </div>
                  )
                })}
                {OFFSET_MODES.some(
                  ({ mode }) => offsetErrors[offsetKey(preset.id, mode)]
                ) && (
                  <p className="error-text">
                    {OFFSET_MODES.map(
                      ({ mode }) => offsetErrors[offsetKey(preset.id, mode)]
                    ).find(Boolean)}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="options-section options-danger-section">
        <label className="options-label">{t("resetLabel")}</label>
        <p className="options-hint">{t("resetHint")}</p>
        <button className="options-danger-button" onClick={handleFactoryReset}>
          {t("resetButton")}
        </button>
        {resetDone && <p className="options-saved-text">{t("resetDone")}</p>}
      </section>

      <SupportLink />

      <p className="options-credit">Icons: Tabler Icons (MIT License)</p>
    </main>
  )
}

function IndexOptions() {
  return (
    <I18nProvider>
      <OptionsContent />
    </I18nProvider>
  )
}

export default IndexOptions
