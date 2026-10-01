import buyMeACoffeeButton from "data-base64:../../assets/buymeacoffee-button.png"

import { useI18n } from "~lib/i18n/useI18n"

const SUPPORT_URL = "https://buymeacoffee.com/uc4696"

/** Buy Me a Coffee への支援リンク（ポップアップ・設定画面の下部で共用）。 */
export function SupportLink() {
  const { t } = useI18n()
  const SUPPORT_TEXT = t("supportText")
  return (
    <section className="support-section">
      <p className="support-text">{SUPPORT_TEXT}</p>
      <a
        className="support-link"
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={SUPPORT_TEXT}>
        <img className="support-image" src={buyMeACoffeeButton} alt={SUPPORT_TEXT} />
      </a>
    </section>
  )
}
