import { useEffect, useState } from "react"

import { Icon } from "~components/Icon"
import { SupportBanner } from "~components/SupportLink"
import { STORE_REVIEW_URL } from "~lib/constants"
import { useI18n } from "~lib/i18n/useI18n"
import {
  closeReviewPrompt,
  loadReviewPromptState,
  postponeReviewPrompt,
  shouldShowReviewPrompt
} from "~lib/review-prompt"

/**
 * ストアの評価のお願いと寄付の案内。出す印は、リサイズ・撮影に成功したときに付ける
 * （src/lib/review-prompt.ts）。
 * ポップアップのいちばん上に大きく出し、本来の中身は下へ押し出す
 * （見落とされないよう、あえて操作の邪魔になる大きさにする）。
 * 「あとで」「表示しない」「ストアで評価する」で閉じる（「表示しない」はアップデートで戻る）。
 */
export function ReviewPrompt() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    void loadReviewPromptState()
      .then((state) => setVisible(shouldShowReviewPrompt(state)))
      .catch(() => undefined)
  }, [])

  if (!visible) return null

  const later = () => {
    setVisible(false)
    void postponeReviewPrompt().catch(() => undefined)
  }
  const close = (rated = false) => {
    setVisible(false)
    void closeReviewPrompt({ rated }).catch(() => undefined)
  }
  const rate = () => {
    void chrome.tabs.create({ url: STORE_REVIEW_URL })
    close(true)
  }

  return (
    <section className="review-prompt" aria-labelledby="review-prompt-title">
      <h2 id="review-prompt-title">{t("reviewPromptTitle")}</h2>
      <div className="review-block">
        <p>{t("reviewPromptBody")}</p>
        <button type="button" className="review-rate" onClick={rate}>
          <Icon name="star" size={18} />
          {t("reviewPromptRate")}
        </button>
      </div>
      <hr className="review-divider" />
      <div className="review-block">
        <p>{t("reviewPromptSupport")}</p>
        <SupportBanner />
      </div>
      <div className="review-actions">
        <button type="button" className="review-secondary" onClick={later}>
          {t("reviewPromptLater")}
        </button>
        <button type="button" className="review-secondary" onClick={() => close()}>
          {t("reviewPromptNever")}
        </button>
      </div>
    </section>
  )
}
