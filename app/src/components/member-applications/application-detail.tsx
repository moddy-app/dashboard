import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  DiscordIcon,
  InformationCircleIcon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ApplicationStatusBadge } from "@/components/member-applications/application-status-badge"
import { UserChip } from "@/components/user-chip"
import { getAvatarUrl } from "@/lib/auth"
import { absoluteTime } from "@/lib/cases"
import { logger } from "@/lib/logger"
import { applicantName, applicationCardUrl, formatRawResponse } from "@/lib/member-applications"
import { getApplication } from "@/services/member-applications"
import type { Application, FormResponse } from "@/types/member-applications"

/**
 * Détail d'une candidature, en panneau latéral. La ligne de liste s'affiche
 * tout de suite ; `GET /applications/{id}` la rafraîchit en arrière-plan (une
 * décision a pu tomber dans Discord entre-temps). Lecture seule : aucune
 * décision ne se prend ici.
 */
export function ApplicationDetailSheet({
  guildId,
  application,
  onOpenChange,
}: {
  guildId: string
  application: Application | null
  onOpenChange: (open: boolean) => void
}) {
  const [fresh, setFresh] = useState<Application | null>(null)

  useEffect(() => {
    if (!application) return
    let active = true
    getApplication(guildId, application.request_id)
      .then((data) => active && setFresh(data))
      // La ligne de liste reste affichée : un échec de rafraîchissement n'a
      // rien d'une erreur bloquante (une candidature purgée à 180 j donne 404).
      .catch((e) => logger.warn("module:member_applications", "Detail refresh failed", e))
    return () => {
      active = false
    }
  }, [guildId, application])

  const shown =
    application && fresh?.request_id === application.request_id ? fresh : application

  return (
    <Sheet open={application !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {shown && <DetailBody application={shown} />}
      </SheetContent>
    </Sheet>
  )
}

function DetailBody({ application }: { application: Application }) {
  const { t, i18n } = useTranslation()
  const name = applicantName(application)
  const cardUrl = applicationCardUrl(application)
  const isPending = application.status === "SUBMITTED"

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage
              src={getAvatarUrl(application.user_id, application.user?.avatar ?? null)}
              alt={t("common.avatarAlt", { name })}
            />
            <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <SheetTitle className="truncate">{name}</SheetTitle>
            <SheetDescription className="truncate">
              {application.user?.username
                ? `@${application.user.username}`
                : application.user_id}
            </SheetDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ApplicationStatusBadge status={application.status} />
          {application.decided_in === "discord" && (
            <Badge variant="secondary">
              <HugeiconsIcon icon={DiscordIcon} strokeWidth={2} data-icon="inline-start" />
              {t("modules.member_applications.decidedInDiscord")}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("modules.member_applications.detail.snapshotHint")}
        </p>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        {/* Chronologie */}
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("modules.member_applications.detail.submittedAt")}</dt>
          <dd>{absoluteTime(application.submitted_at ?? application.created_at, i18n.language)}</dd>
          {!isPending && (
            <>
              <dt className="text-muted-foreground">{t("modules.member_applications.detail.reviewedBy")}</dt>
              <dd className="min-w-0">
                {application.reviewed_by ? (
                  <UserChip userId={application.reviewed_by} />
                ) : (
                  <span className="text-muted-foreground">
                    {t("modules.member_applications.detail.unknownReviewer")}
                  </span>
                )}
              </dd>
              {application.reviewed_at && (
                <>
                  <dt className="text-muted-foreground">{t("modules.member_applications.detail.reviewedAt")}</dt>
                  <dd>{absoluteTime(application.reviewed_at, i18n.language)}</dd>
                </>
              )}
            </>
          )}
        </dl>

        {application.status === "REJECTED" && application.rejection_reason && (
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertTitle>{t("modules.member_applications.detail.rejectionReason")}</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{application.rejection_reason}</AlertDescription>
          </Alert>
        )}

        {application.status === "WITHDRAWN" && (
          <Alert>
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertTitle>{t("modules.member_applications.status.WITHDRAWN")}</AlertTitle>
            <AlertDescription>{t("modules.member_applications.detail.withdrawnHint")}</AlertDescription>
          </Alert>
        )}

        {isPending && !application.message_id && (
          <Alert>
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
            <AlertTitle>{t("modules.member_applications.detail.cardPendingTitle")}</AlertTitle>
            <AlertDescription>{t("modules.member_applications.detail.cardPending")}</AlertDescription>
          </Alert>
        )}

        <Separator />

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">{t("modules.member_applications.detail.responses")}</h3>
          {application.form_responses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("modules.member_applications.detail.noResponses")}
            </p>
          ) : (
            application.form_responses.map((response, index) => (
              <ResponseBlock key={index} response={response} />
            ))
          )}
        </section>
      </div>

      {isPending && cardUrl && (
        <SheetFooter className="border-t">
          <Button asChild>
            <a href={cardUrl} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} data-icon="inline-start" />
              {t("modules.member_applications.detail.openCard")}
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t("modules.member_applications.detail.decideInDiscord")}
          </p>
        </SheetFooter>
      )}
    </>
  )
}

/** Une question du formulaire d'adhésion et sa réponse. */
function ResponseBlock({ response }: { response: FormResponse }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">
        {response.label || t("modules.member_applications.detail.untitledQuestion")}
      </p>
      <ResponseValue response={response} />
    </div>
  )
}

function ResponseValue({ response }: { response: FormResponse }) {
  const { t } = useTranslation()
  switch (response.field_type) {
    case "TERMS":
      return (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            {response.response && (
              <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
            )}
            {response.response
              ? t("modules.member_applications.detail.termsAccepted")
              : t("modules.member_applications.detail.termsNotAccepted")}
          </p>
          {response.values.length > 0 && (
            <ol className="ml-4 flex list-decimal flex-col gap-1 text-muted-foreground">
              {response.values.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ol>
          )}
        </div>
      )
    case "MULTIPLE_CHOICE":
      // `response_label: null` = réponse illisible — on ne devine pas avec l'index.
      return response.response_label !== null ? (
        <p className="text-sm">{response.response_label}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {t("modules.member_applications.detail.unknownAnswer")}
        </p>
      )
    case "TEXT_INPUT":
    case "PARAGRAPH":
      return response.response ? (
        <p className="text-sm whitespace-pre-wrap break-words">{response.response}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {t("modules.member_applications.detail.emptyAnswer")}
        </p>
      )
    default: {
      const raw = formatRawResponse(response.response)
      return raw ? (
        <p className="text-sm whitespace-pre-wrap break-words">{raw}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {t("modules.member_applications.detail.emptyAnswer")}
        </p>
      )
    }
  }
}
