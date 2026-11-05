import { Icon, type IconName } from "~components/Icon"
import { STORE_URL } from "~lib/constants"
import { useI18n } from "~lib/i18n/useI18n"
import { buildShareTargetUrl, SHARE_TARGETS } from "~lib/share"

/** SNS の投稿画面を新規タブで開く共有ボタンの列。説明はツールチップに出す。 */
export function ShareButtons() {
  const { t } = useI18n()
  const content = {
    message: t("shareText"),
    storeUrl: STORE_URL,
    hashtags: t("shareHashtags")
  }
  return (
    <>
      {SHARE_TARGETS.map(({ id, name }) => {
        const label = t("shareOnTitle", { name })
        return (
          <a
            key={id}
            className="footer-icon-button share-button"
            data-share={id}
            href={buildShareTargetUrl(id, content)}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            aria-label={label}
          >
            <Icon name={`brand-${id}` as IconName} size={16} />
          </a>
        )
      })}
    </>
  )
}
