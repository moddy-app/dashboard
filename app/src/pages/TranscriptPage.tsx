import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { ArchiveXIcon, FileWarningIcon, ShieldAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ModdyLogo } from "@/components/moddy-logo"
import { TranscriptView } from "@/components/tickets/transcript-view"
import { useAuth } from "@/hooks/useAuth"
import { useViewportHeight } from "@/hooks/useViewportHeight"
import { login } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { transcriptErrorKind } from "@/lib/transcripts"
import type { TranscriptErrorKind } from "@/lib/transcripts"
import { getTranscript } from "@/services/tickets"
import type { TranscriptDetail } from "@/types/transcripts"

/**
 * `https://dashboard.moddy.app/transcripts/<uuid>` — le lien que le bot donne à
 * deux publics : le salon de journal (l'équipe) **et** le DM de fermeture
 * (l'auteur du ticket). Ce dernier n'est pas forcément administrateur d'un
 * serveur, donc la page vit **hors du châssis du dashboard** : ni sélecteur de
 * serveur, ni sidebar, juste une session valide.
 *
 * La `key` est le seul élément secret du lien : on ne l'affiche nulle part
 * ailleurs que dans la barre d'adresse, et le bouton « copier le lien » le dit.
 */
export function TranscriptPage() {
  const { key } = useParams<{ key: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const auth = useAuth()
  useViewportHeight()

  /**
   * L'état porte la **clé résolue** : tant qu'elle ne correspond pas à celle de
   * l'URL, l'écran est en chargement. Sans ça, réinitialiser l'état à chaque
   * changement de clé demanderait un `setState` synchrone dans l'effet — et une
   * cascade de rendus.
   */
  const [result, setResult] = useState<{
    key: string
    transcript: TranscriptDetail | null
    errorKind: TranscriptErrorKind | null
  } | null>(null)

  useEffect(() => {
    // La route exige une session : on renvoie vers la connexion **en gardant
    // l'URL courante**, pour revenir sur l'archive et pas sur l'accueil.
    if (auth.status === "unauthenticated") login(window.location.href)
  }, [auth.status])

  useEffect(() => {
    if (auth.status !== "authenticated" || !key) return
    let cancelled = false

    getTranscript(key)
      .then((data) => {
        if (!cancelled) setResult({ key, transcript: data, errorKind: null })
      })
      .catch((e) => {
        if (cancelled) return
        logger.error("transcript", "Load failed", e)
        // Un `422` n'est **pas** un problème de droits et ne se rejoue pas : on
        // ne redirige pas, on explique.
        setResult({ key, transcript: null, errorKind: transcriptErrorKind(e) })
      })

    return () => {
      cancelled = true
    }
  }, [auth.status, key])

  const loaded = result?.key === key ? result : null
  const transcript = loaded?.transcript ?? null
  const errorKind = loaded?.errorKind ?? null

  const body = () => {
    if (errorKind) return <TranscriptError kind={errorKind} onHome={() => navigate("/")} />
    if (!transcript) {
      return (
        <div className="flex w-full flex-col gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="min-h-64 flex-1 rounded-xl" />
        </div>
      )
    }
    return <TranscriptView transcript={transcript} onBack={() => navigate(-1)} className="flex-1" />
  }

  return (
    <div className="flex h-[var(--app-height,100dvh)] flex-col bg-background">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <ModdyLogo className="h-5" />
          <span className="sr-only">{t("modules.tickets.transcript.backToDashboard")}</span>
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4 py-5 sm:px-6 lg:px-8">{body()}</main>
    </div>
  )
}

/**
 * Le `404` est **volontairement indistinguable** : clé inconnue, clé mal formée
 * ou lecteur non autorisé. On dit donc « introuvable ou lien expiré », jamais
 * « vous n'avez pas accès » — confirmer qu'une clé existe est déjà une fuite.
 */
function TranscriptError({ kind, onHome }: { kind: TranscriptErrorKind; onHome: () => void }) {
  const { t } = useTranslation()

  const { Icon, title, description } = {
    notFound: {
      Icon: ArchiveXIcon,
      title: t("modules.tickets.transcript.errors.notFoundTitle"),
      description: t("modules.tickets.transcript.errors.notFoundDescription"),
    },
    unrenderable: {
      Icon: FileWarningIcon,
      title: t("modules.tickets.transcript.errors.unrenderableTitle"),
      description: t("modules.tickets.transcript.errors.unrenderableDescription"),
    },
    suspended: {
      Icon: ShieldAlertIcon,
      title: t("modules.tickets.transcript.errors.suspendedTitle"),
      description: t("modules.tickets.transcript.errors.suspendedDescription"),
    },
    unknown: {
      Icon: FileWarningIcon,
      title: t("modules.tickets.transcript.errors.unknownTitle"),
      description: t("modules.tickets.transcript.errors.unknownDescription"),
    },
  }[kind]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <Button variant="outline" size="sm" onClick={onHome} className="mt-2">
        {t("modules.tickets.transcript.backToDashboard")}
      </Button>
    </div>
  )
}
