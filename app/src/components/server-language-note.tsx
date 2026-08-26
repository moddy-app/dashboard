import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { LanguagesIcon } from "lucide-react"

interface ServerLanguageNoteProps {
  guildId: string | null
  className?: string
}

/**
 * Remplace les anciens sélecteurs de langue par module. Il n'y a plus qu'un
 * réglage de langue, au niveau du serveur : chaque module concerné y renvoie
 * plutôt que de laisser croire qu'il a le sien.
 */
export function ServerLanguageNote({ guildId, className }: ServerLanguageNoteProps) {
  const { t } = useTranslation()
  if (!guildId) return null
  return (
    <p
      className={`flex items-start gap-2 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <LanguagesIcon className="size-3.5 mt-0.5 shrink-0" />
      <span>
        {t("guildSettings.language.moduleNote")}{" "}
        <Link
          to={`/servers/${guildId}/settings`}
          className="text-primary underline underline-offset-2"
        >
          {t("guildSettings.title")}
        </Link>
      </span>
    </p>
  )
}
