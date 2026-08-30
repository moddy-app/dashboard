import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { openBillingPortal } from "@/services/guilds"

// Route /billing : redirige directement vers le portail Stripe (gestion d'abonnement),
// sans passer par l'onglet Billing des paramètres.
export function BillingRedirectPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true

    openBillingPortal()
      .then((url) => {
        window.location.href = url
      })
      .catch(() => {
        toast.error(t('settings.billing.portalError'))
        navigate('/?openSettings=billing', { replace: true })
      })
  }, [navigate, t])

  return null
}
