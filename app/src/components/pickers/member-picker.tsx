import * as React from "react"
import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Spinner } from "@/components/ui/spinner"
import { useGuildContext } from "@/contexts/GuildContext"
import { MultiPickerShell, SinglePickerShell } from "@/components/pickers/picker-shell"
import { ApiError } from "@/lib/auth"
import { resolveMembers, searchMembers, type GuildMember } from "@/services/members"

const DEBOUNCE_MS = 300

type Resolved = GuildMember | "not_found" | "unavailable"

// Cache module des membres déjà vus (recherche ou résolution), par serveur.
const known = new Map<string, Resolved>()
const keyOf = (guildId: string, id: string) => `${guildId}:${id}`

/** Résout les ids choisis en membres ; ceux déjà vus ne sont pas redemandés. */
function useResolvedMembers(guildId: string | null, ids: string[]) {
  const [, setTick] = React.useState(0)
  const idsKey = ids.join(",")

  React.useEffect(() => {
    if (!guildId) return
    const missing = idsKey
      .split(",")
      .filter((id) => id && !known.has(keyOf(guildId, id)))
    if (missing.length === 0) return
    let cancelled = false
    resolveMembers(guildId, missing)
      .then((res) => {
        for (const m of res.members) known.set(keyOf(guildId, m.id), m)
        for (const id of res.not_found) known.set(keyOf(guildId, id), "not_found")
        for (const id of res.unavailable) known.set(keyOf(guildId, id), "unavailable")
      })
      .catch(() => {
        // Réseau / 503 : l'id brut reste affiché ; rien n'est mémorisé.
      })
      .finally(() => {
        if (!cancelled) setTick((n) => n + 1)
      })
    return () => {
      cancelled = true
    }
  }, [guildId, idsKey])

  return (id: string): Resolved | undefined => (guildId ? known.get(keyOf(guildId, id)) : undefined)
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function MemberAvatar({ member, className }: { member?: GuildMember; className?: string }) {
  const name = member?.display_name ?? "?"
  return (
    <Avatar className={className ?? "size-6"}>
      {member && <AvatarImage src={member.avatar_url} alt="" />}
      <AvatarFallback className="text-[10px]">{name.slice(0, 2)}</AvatarFallback>
    </Avatar>
  )
}

interface SearchState {
  results: GuildMember[]
  loading: boolean
  /** `rate_limited` = 503 ; `failed` = autre erreur. */
  error: "rate_limited" | "failed" | null
}

function useMemberSearch(guildId: string | null, query: string, enabled: boolean): SearchState {
  const [state, setState] = React.useState<SearchState>({ results: [], loading: false, error: null })
  const debounced = useDebounced(query.trim(), DEBOUNCE_MS)
  const pending = enabled && query.trim() !== debounced

  React.useEffect(() => {
    if (!enabled || !guildId || !debounced) {
      setState({ results: [], loading: false, error: null })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    searchMembers(guildId, debounced)
      .then((res) => {
        if (cancelled) return
        for (const m of res.members) known.set(keyOf(guildId, m.id), m)
        setState({ results: res.members, loading: false, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        const rateLimited = err instanceof ApiError && err.status === 503
        setState({ results: [], loading: false, error: rateLimited ? "rate_limited" : "failed" })
      })
    return () => {
      cancelled = true
    }
  }, [guildId, debounced, enabled])

  return { ...state, loading: state.loading || pending }
}

interface MemberListProps {
  guildId: string | null
  open: boolean
  selected: string[]
  onSelect: (member: GuildMember) => void
  isDisabled: (id: string) => boolean
  none?: { label: string; onSelect: () => void; checked: boolean }
}

function MemberList({ guildId, open, selected, onSelect, isDisabled, none }: MemberListProps) {
  const { t } = useTranslation()
  const [query, setQuery] = React.useState("")
  const { results, loading, error } = useMemberSearch(guildId, query, open)
  const hasQuery = query.trim().length > 0

  let emptyText: string | null = null
  if (!loading && results.length === 0) {
    if (error === "rate_limited") emptyText = t("pickers.member.rateLimited")
    else if (error === "failed") emptyText = t("pickers.member.failed")
    else emptyText = hasQuery ? t("pickers.member.empty") : t("pickers.member.hint")
  }

  return (
    // Le filtrage est côté serveur : cmdk ne doit rien masquer.
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("pickers.member.search")}
      />
      <CommandList>
        {none && !hasQuery && (
          <CommandGroup>
            <CommandItem value="__none__" data-checked={none.checked} onSelect={none.onSelect}>
              <span className="truncate text-muted-foreground">{none.label}</span>
            </CommandItem>
          </CommandGroup>
        )}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Spinner />
            {t("pickers.member.loading")}
          </div>
        )}
        {emptyText && <CommandEmpty>{emptyText}</CommandEmpty>}
        {!loading && results.length > 0 && (
          <CommandGroup>
            {results.map((m) => (
              <CommandItem
                key={m.id}
                value={m.id}
                disabled={isDisabled(m.id)}
                data-checked={selected.includes(m.id)}
                onSelect={() => onSelect(m)}
              >
                <MemberAvatar member={m} />
                <span className="truncate">{m.display_name}</span>
                <span className="truncate text-xs text-muted-foreground">@{m.username}</span>
                {m.bot && <Badge variant="secondary">{t("pickers.member.bot")}</Badge>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}

interface BaseMemberProps {
  /** Défaut : serveur sélectionné. */
  guildId?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  "aria-invalid"?: boolean
}

export interface MemberPickerProps extends BaseMemberProps {
  value: string | null
  onChange: (value: string | null) => void
  allowNone?: boolean
  noneLabel?: string
}

export function MemberPicker({
  value,
  onChange,
  guildId: guildIdProp,
  allowNone,
  noneLabel,
  placeholder,
  disabled,
  id,
  "aria-invalid": invalid,
}: MemberPickerProps) {
  const { t } = useTranslation()
  const ctx = useGuildContext()
  const guildId = guildIdProp ?? ctx.selectedGuildId
  const [open, setOpen] = React.useState(false)
  const lookup = useResolvedMembers(guildId, value ? [value] : [])
  const current = value ? lookup(value) : undefined

  let display: React.ReactNode
  if (value && current && typeof current === "object") {
    display = (
      <>
        <MemberAvatar member={current} className="size-5" />
        <span className="truncate">{current.display_name}</span>
      </>
    )
  } else if (value) {
    display = (
      <span className="truncate text-muted-foreground">
        {current === "not_found" ? t("pickers.member.notFound") : value}
      </span>
    )
  } else {
    display = (
      <span className="truncate text-muted-foreground">
        {noneLabel && allowNone ? noneLabel : (placeholder ?? t("pickers.member.placeholder"))}
      </span>
    )
  }

  return (
    <SinglePickerShell
      id={id}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      invalid={invalid}
      display={display}
    >
      <MemberList
        guildId={guildId}
        open={open}
        selected={value ? [value] : []}
        onSelect={(m) => {
          onChange(m.id)
          setOpen(false)
        }}
        isDisabled={() => false}
        none={
          allowNone
            ? {
                label: noneLabel ?? t("pickers.member.none"),
                checked: value === null,
                onSelect: () => {
                  onChange(null)
                  setOpen(false)
                },
              }
            : undefined
        }
      />
    </SinglePickerShell>
  )
}

export interface MemberMultiPickerProps extends BaseMemberProps {
  value: string[]
  onChange: (value: string[]) => void
  max?: number
}

export function MemberMultiPicker({
  value,
  onChange,
  guildId: guildIdProp,
  max,
  placeholder,
  disabled,
  id,
  "aria-invalid": invalid,
}: MemberMultiPickerProps) {
  const { t } = useTranslation()
  const ctx = useGuildContext()
  const guildId = guildIdProp ?? ctx.selectedGuildId
  const [open, setOpen] = React.useState(false)
  const lookup = useResolvedMembers(guildId, value)
  const isFull = max !== undefined && value.length >= max

  const toggle = (memberId: string) =>
    onChange(value.includes(memberId) ? value.filter((v) => v !== memberId) : [...value, memberId])

  const chips = value.map((memberId) => {
    const r = lookup(memberId)
    if (r && typeof r === "object") {
      return { key: memberId, label: r.display_name, icon: <MemberAvatar member={r} className="size-4" /> }
    }
    return {
      key: memberId,
      label: r === "not_found" ? t("pickers.member.notFound") : memberId,
      muted: true,
    }
  })

  return (
    <MultiPickerShell
      id={id}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      invalid={invalid}
      chips={chips}
      placeholder={placeholder ?? t("pickers.member.placeholderMulti")}
      onRemove={toggle}
    >
      <MemberList
        guildId={guildId}
        open={open}
        selected={value}
        onSelect={(m) => toggle(m.id)}
        isDisabled={(memberId) => isFull && !value.includes(memberId)}
      />
    </MultiPickerShell>
  )
}
