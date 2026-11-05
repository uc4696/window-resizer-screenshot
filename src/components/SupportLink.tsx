import buyMeACoffeeButton from "data-base64:../../assets/buymeacoffee-button.png"

import { useI18n } from "~lib/i18n/useI18n"

const SUPPORT_URL = "https://buymeacoffee.com/uc4696"

/** Buy Me a Coffee のボタンの画像とリンク（評価のお願いでも使う）。 */
export function SupportBanner() {
  const { t } = useI18n()
  const label = t("supportText")
  return (
    <a
      className="support-link"
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
    >
      <img className="support-image" src={buyMeACoffeeButton} alt={label} />
    </a>
  )
}

/** Buy Me a Coffee への支援リンク（ポップアップ・設定画面の下部で共用）。 */
export function SupportLink() {
  const { t } = useI18n()
  return (
    <section className="support-section">
      <p className="support-text">{t("supportText")}</p>
      <SupportBanner />
    </section>
  )
}
