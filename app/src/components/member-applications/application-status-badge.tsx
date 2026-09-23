import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  ArrowTurnBackwardIcon,
  Cancel01Icon,
  Clock01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import type { ApplicationStatus } from "@/types/member-applications"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

/** Apparence par statut — variantes stock du `Badge`, aucune couleur brute. */
const APPLICATION_STATUS_APPEARANCE: Record<
  ApplicationStatus,
  { variant: BadgeVariant; icon: IconSvgElement }
> = {
  SUBMITTED: { variant: "outline", icon: Clock01Icon },
  APPROVED: { variant: "default", icon: Tick02Icon },
  REJECTED: { variant: "destructive", icon: Cancel01Icon },
  WITHDRAWN: { variant: "secondary", icon: ArrowTurnBackwardIcon },
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const { t } = useTranslation()
  const { variant, icon } = APPLICATION_STATUS_APPEARANCE[status]
  return (
    <Badge variant={variant}>
      <HugeiconsIcon icon={icon} strokeWidth={2} data-icon="inline-start" />
      {t(`modules.member_applications.status.${status}`)}
    </Badge>
  )
}
