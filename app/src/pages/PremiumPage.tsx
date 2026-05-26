import { useEffect, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LoaderIcon } from "lucide-react"
import { createCheckout } from "@/services/guilds"
import { handleSaveError } from "@/lib/handle-error"

export function PremiumPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const premiumStatus = searchParams.get("premium")

    if (premiumStatus === "success") {
      toast.success(t("premium.toast.successTitle"), {
        description: t("premium.toast.successDescription"),
      })
      navigate("/", { replace: true })
      return
    }

    if (premiumStatus === "cancel") {
      toast.info(t("premium.toast.cancelTitle"), {
        description: t("premium.toast.cancelDescription"),
      })
      navigate("/", { replace: true })
      return
    }

    const plan: "monthly" | "yearly" = searchParams.has("yearly") ? "yearly" : "monthly"

    createCheckout(plan)
      .then((url) => {
        window.location.href = url
      })
      .catch((e) => {
        handleSaveError(e, { title: t("premium.toast.checkoutError") })
        navigate("/", { replace: true })
      })
  }, [searchParams, navigate, t])

  return (
    <div className="flex flex-1 items-center justify-center">
      <LoaderIcon className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
