import { useTranslation } from "react-i18next"
import { DiscordMarkup } from "@/components/discord-markup"
import { NameStylePreview } from "@/components/name-style-preview"
import { useTheme } from "@/components/theme-provider"
import { effectSlug, fontSlug } from "@/lib/discord-name-styles"
import { getGuildIconUrl, type Guild } from "@/lib/auth"
import { cn } from "@/lib/utils"

/**
 * Popout de profil Discord — le vrai composant, pas une imitation.
 *
 * La structure et les noms de classes (`outer_c0bea0`, `body__5be3e`,
 * `displayNameRow__26b1f`…) sont ceux du DOM Discord ; le CSS correspondant est
 * repris tel quel dans `src/styles/discord-profile.css`. Ce fichier ne décide
 * d'aucun style : il reproduit l'arbre et y branche les données.
 *
 * Écarts assumés par rapport au DOM capturé, tous invisibles :
 *   - les nœuds de mesure du statut (`referenceContainer_ab8609`,
 *     `visibility:hidden`) servent au calcul de clamp côté JS Discord ;
 *   - le bouton « ajouter une note » (`button__0f074`, `opacity:0`) et le
 *     conteneur de boutons vide (`buttons_bc38cd`) ne sont pas rendus ;
 *   - `focusTarget__54e4b` dépend du modèle de focus de Discord.
 */

/** Discord n'affiche que les 3 premières icônes, puis le total en texte. */
const MUTUALS_SHOWN = 3

/**
 * Statut personnalisé de Moddy. Aucun endpoint ne l'expose et il n'est pas
 * configurable par le module — mais il fait partie du profil réel et la bulle
 * structure la mise en page. Écrit en dur, ici et nulle part ailleurs.
 */
const BOT_STATUS = "🔗 moddy.app"

/** Initiales façon Discord : une lettre par mot, 2 max. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

/** `.botTag__82f07` — étiquette APP avec la coche « application vérifiée ». */
function BotTag({ label }: { label: string }) {
  return (
    <span
      className="botTag__26b1f botTagRegular__82f07 botTag__82f07 px__82f07"
      role="img"
      aria-label={label}
    >
      <svg
        className="botTagVerified__82f07"
        aria-hidden="true"
        fill="none"
        height="24"
        viewBox="0 0 24 24"
        width="24"
      >
        <path
          clipRule="evenodd"
          d="M19.06 6.94a1.5 1.5 0 0 1 0 2.12l-8 8a1.5 1.5 0 0 1-2.12 0l-4-4a1.5 1.5 0 0 1 2.12-2.12L10 13.88l6.94-6.94a1.5 1.5 0 0 1 2.12 0Z"
          fill="var(--white)"
          fillRule="evenodd"
        />
      </svg>
      <span className="botText__82f07">APP</span>
    </span>
  )
}

/** `.avatars_a05532` — icône de serveur masquée en squircle. */
function MutualIcon({ guild }: { guild: Guild }) {
  const iconUrl = getGuildIconUrl(guild.id, guild.icon)
  return (
    <li className="size16_a05532">
      <svg className="svg__2338f" height="16" width="16" viewBox="0 0 16 16">
        <foreignObject
          height="16"
          width="16"
          x="0"
          y="0"
          overflow="visible"
          mask="url(#dpp-mask-squircle)"
        >
          <div className="squircleIcon_a05532">
            {iconUrl ? (
              <div
                className="icon_f34534 iconSizeSmol_f34534 iconActiveSmol_f34534"
                style={{ backgroundImage: `url("${iconUrl}")` }}
                title={guild.name}
              />
            ) : (
              <div className="dpp-guild-initials" title={guild.name}>
                {initials(guild.name)}
              </div>
            )}
          </div>
        </foreignObject>
      </svg>
    </li>
  )
}

export interface DiscordProfilePreviewProps {
  /** Nom affiché — pseudo de guilde, ou nom global du bot à défaut. */
  displayName: string
  /** Nom d'utilisateur Discord global (ligne sous le nom affiché). */
  username: string
  /** Bio résolue (guilde ou globale), en markdown Discord. */
  bio: string
  /** Ligne d'attribution ajoutée par le bot, non éditable. */
  bioAttribution?: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  /** Couleur d'accent Discord (entier), fond de bannière sans image. */
  accentColor: number | null
  /** Serveurs que l'utilisateur a en commun avec le bot. */
  mutualGuilds: Guild[]
  /** Style du pseudo — identifiants d'API du module. */
  fontId: number | null
  effectId: number | null
  gradientEffectId?: number
  /** Couleurs du style, en `#RRGGBB`. Vide = couleur de texte Discord. */
  colors: string[]
  className?: string
}

export function DiscordProfilePreview({
  displayName,
  username,
  bio,
  bioAttribution,
  avatarUrl,
  bannerUrl,
  accentColor,
  mutualGuilds,
  fontId,
  effectId,
  gradientEffectId,
  colors,
  className,
}: DiscordProfilePreviewProps) {
  const { t } = useTranslation()
  const { theme } = useTheme()

  // Le thème du dashboard pilote celui de la carte. `system` est résolu ici
  // plutôt qu'en CSS : les règles Discord testent une classe, pas une media query.
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  // Découpe circulaire autour de l'avatar : `fill_b83360` lit ces trois
  // variables, que Discord pose en style inline sur l'élément. Sans elles, le
  // `mask-image` est invalide et la bannière passe derrière l'avatar.
  const bannerStyle: React.CSSProperties & Record<string, string | number | undefined> = {
    "--custom-cutout-radius": "46px",
    "--custom-cutout-x": "56px",
    "--custom-cutout-y": "calc(100% - 4px)",
    // Sans bannière, Discord peint la couleur d'accent du profil.
    ...(bannerUrl
      ? { backgroundImage: `url("${bannerUrl}")` }
      : {
          backgroundColor:
            accentColor !== null ? `#${accentColor.toString(16).padStart(6, "0")}` : undefined,
        }),
  }

  // L'aperçu rend exactement ce que le formulaire décrit — aucun repli implicite.
  // « Aucun effet » doit être *vraiment* aucun effet : le style global du bot
  // (pop bleu) sert d'amorce au brouillon (`styleToDraft`), pas de valeur de
  // secours ici, sinon on ne peut plus afficher l'absence d'effet.
  const nameStyle = {
    font: fontSlug(fontId),
    effect: effectSlug(effectId, gradientEffectId),
    colors,
    // Ni effet ni couleur → pseudo nu, dans la couleur de texte de Discord.
    plain: effectId === null && colors.length === 0,
  }

  const hasBio = Boolean(bio.trim() || bioAttribution)

  return (
    <div
      className={cn(
        "dpp-scope outer_c0bea0 user-profile-popout",
        isDark ? "theme-dark theme-midnight images-dark" : "theme-light images-light",
        className
      )}
    >
      {/* Masque squircle des icônes de serveur, défini une fois par carte. */}
      <svg
        aria-hidden="true"
        style={{ position: "absolute", pointerEvents: "none", width: 1, height: 1 }}
        viewBox="0 0 1 1"
      >
        <mask id="dpp-mask-squircle" maskContentUnits="objectBoundingBox" viewBox="0 0 1 1">
          <path
            d="M0 0.464C0 0.301585 0 0.220377 0.0316081 0.158343C0.0594114 0.103776 0.103776 0.0594114 0.158343 0.0316081C0.220377 0 0.301585 0 0.464 0H0.536C0.698415 0 0.779623 0 0.841657 0.0316081C0.896224 0.0594114 0.940589 0.103776 0.968392 0.158343C1 0.220377 1 0.301585 1 0.464V0.536C1 0.698415 1 0.779623 0.968392 0.841657C0.940589 0.896224 0.896224 0.940589 0.841657 0.968392C0.779623 1 0.698415 1 0.536 1H0.464C0.301585 1 0.220377 1 0.158343 0.968392C0.103776 0.940589 0.0594114 0.896224 0.0316081 0.841657C0 0.779623 0 0.698415 0 0.536V0.464Z"
            fill="white"
          />
        </mask>
      </svg>

      <div className="inner_c0bea0">
        <div className="header__5be3e">
          <div className="banner_b83360" style={{ height: 105, width: "100%" }}>
            <div className="fill_b83360 banner__68edb" style={bannerStyle} />
          </div>

          <div className="avatar__75742">
            <div
              className="wrapper__44b0c"
              role="img"
              aria-label={displayName}
              style={{ width: 80, height: 80 }}
            >
              <div className="avatarStack__44b0c">
                {avatarUrl ? (
                  <img
                    className="avatar__44b0c"
                    src={avatarUrl}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="avatar__44b0c dpp-avatar-initials">{initials(displayName)}</div>
                )}
              </div>
            </div>
          </div>

          <div className="container_ab8609">
            <div className="ring_ab8609" role="tooltip" aria-label={BOT_STATUS}>
              <div className="outer_ab8609">
                <span className="inner_ab8609">
                  <div className="content_ab8609" style={{ maxHeight: 18 }}>
                    <div
                      className="defaultColor__4bd52 text-sm/normal_cf4812 statusText_ab8609"
                      data-text-variant="text-sm/normal"
                    >
                      {BOT_STATUS}
                    </div>
                  </div>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="body__5be3e" dir="ltr">
          <div>
            <div className="displayNameRow__26b1f">
              <div
                className="defaultColor__4bd52 heading-lg/bold_cf4812 displayName__26b1f"
                data-text-variant="heading-lg/bold"
              >
                <NameStylePreview name={displayName} wrap {...nameStyle} />
              </div>
              <BotTag label={t("modules.bot_customization.preview.verifiedApp")} />
            </div>

            <div className="usernameAndPronounsRow__26b1f isBot__26b1f">
              <div className="userTag__26b1f text-sm/normal__26b1f nameTag__05e81">
                <span className="username__05e81 userTagUsername__26b1f">{username}</span>
              </div>
              <div
                className="container__8061a"
                role="group"
                aria-label={t("modules.bot_customization.preview.badges")}
              >
                <img
                  className="badge__8061a"
                  src="/images/discord-badge-supports-commands.png"
                  alt={t("modules.bot_customization.preview.supportsCommands")}
                  title={t("modules.bot_customization.preview.supportsCommands")}
                />
              </div>
            </div>
          </div>

          {mutualGuilds.length > 0 && (
            <div className="mutuals__530ce">
              <div className="section__530ce">
                <ul className="avatars_a05532">
                  {mutualGuilds.slice(0, MUTUALS_SHOWN).map((g) => (
                    <MutualIcon key={String(g.id)} guild={g} />
                  ))}
                </ul>
                <div
                  className="text-sm/normal_cf4812 text__530ce"
                  data-text-variant="text-sm/normal"
                  style={{ color: "var(--interactive-text-default)" }}
                >
                  {t("modules.bot_customization.preview.mutualServers", {
                    count: mutualGuilds.length,
                  })}
                </div>
              </div>
            </div>
          )}

          {hasBio && (
            <section className="section_bf424d">
              {/* `descriptionClamp_f5f93a` limite Discord à 3 lignes ; en
                  aperçu la bio doit rester lisible en entier pendant l'édition. */}
              <div className="dpp-description-unclamped">
                <div className="markup__75297">
                  <div
                    className="text-sm/normal_cf4812"
                    data-text-variant="text-sm/normal"
                    style={{ color: "var(--text-strong)" }}
                  >
                    {bio.trim() && <DiscordMarkup text={bio.trim()} />}
                    {bio.trim() && bioAttribution ? "\n" : null}
                    {bioAttribution && <DiscordMarkup text={bioAttribution} />}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Squelette affiché tant que le profil global du bot n'est pas chargé. Reprend
 * le gabarit exact de la carte (300 px, bannière de 105 px, avatar à 61 px)
 * pour qu'aucun décalage ne se produise à l'arrivée des données.
 */
export function DiscordProfilePreviewSkeleton({ className }: { className?: string }) {
  const { theme } = useTheme()
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <div
      className={cn(
        "dpp-scope outer_c0bea0 user-profile-popout",
        isDark ? "theme-dark theme-midnight images-dark" : "theme-light images-light",
        className
      )}
      aria-busy="true"
    >
      <div className="inner_c0bea0">
        <div className="header__5be3e">
          <div className="banner_b83360" style={{ height: 105, width: "100%" }}>
            <div
              className="fill_b83360 banner__68edb dpp-skeleton"
              style={
                {
                  "--custom-cutout-radius": "46px",
                  "--custom-cutout-x": "56px",
                  "--custom-cutout-y": "calc(100% - 4px)",
                } as React.CSSProperties
              }
            />
          </div>
          <div className="avatar__75742">
            <div className="wrapper__44b0c" style={{ width: 80, height: 80 }}>
              <div className="avatar__44b0c dpp-skeleton" style={{ width: 80, height: 80 }} />
            </div>
          </div>
        </div>
        <div className="body__5be3e">
          <div>
            <div className="displayNameRow__26b1f">
              <div className="dpp-skeleton dpp-skeleton-line" style={{ width: 120, height: 24 }} />
            </div>
            <div className="usernameAndPronounsRow__26b1f isBot__26b1f">
              <div className="dpp-skeleton dpp-skeleton-line" style={{ width: 70, height: 14 }} />
            </div>
          </div>
          <div className="dpp-skeleton dpp-skeleton-line" style={{ width: 150, height: 16 }} />
          <div className="section_bf424d">
            <div className="dpp-skeleton dpp-skeleton-line" style={{ width: "100%", height: 14 }} />
            <div className="dpp-skeleton dpp-skeleton-line" style={{ width: "70%", height: 14 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
