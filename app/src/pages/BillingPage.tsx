import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { LoaderIcon } from "lucide-react"
import { openBillingPortal } from "@/services/guilds"
import { handleSaveError } from "@/lib/handle-error"

export function BillingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    openBillingPortal()
      .then((url) => {
        window.location.href = url
      })
      .catch((e) => {
        handleSaveError(e, { title: t("settings.billing.portalError") })
        navigate("/", { replace: true })
      })
  }, [navigate, t])

  return (
    <div className="flex flex-1 items-center justify-center">
      <LoaderIcon className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
