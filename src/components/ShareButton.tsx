import { Icon } from "~components/Icon"
import { STORE_URL } from "~lib/constants"
import { useI18n } from "~lib/i18n/useI18n"
import { buildShareText, buildShareUrl } from "~lib/share"

/** X（旧Twitter）の投稿画面を新規タブで開く共有ボタン。アイコン + 文字ラベルで共有操作だと分かるようにする。 */
export function ShareButton() {
  const { t } = useI18n()
  const url = buildShareUrl(buildShareText(t("shareText"), STORE_URL, t("shareHashtags")))
  return (
    <a
      className="share-button"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={t("shareOnXTitle")}
      aria-label={t("shareOnXTitle")}>
      <Icon name="brand-x" size={14} />
      <span>{t("shareOnX")}</span>
    </a>
  )
}
