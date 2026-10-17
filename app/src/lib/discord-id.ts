const SNOWFLAKE_RE = /^\d{17,20}$/
const MENTION_RE = /^<@!?(\d{17,20})>$/

/** Extrait un identifiant d'une saisie (`123…`, `<@123…>` ou `<@!123…>`), sinon `null`. */
export function parseUserId(raw: string): string | null {
  const text = raw.trim()
  const mention = MENTION_RE.exec(text)
  const id = mention ? mention[1] : text
  return SNOWFLAKE_RE.test(id) ? id : null
}
