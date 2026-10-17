import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  CampaignIcon,
  ChatBubbleIcon,
  FolderIcon,
  ForumIcon,
  PodcastsIcon,
  TagIcon,
  VolumeUpIcon,
  type IconComponent,
} from "@/components/icons"
import { useGuildContext } from "@/contexts/GuildContext"
import { MultiPickerShell, SinglePickerShell } from "@/components/pickers/picker-shell"
import type { Channel } from "@/types/api"

export type ChannelKind = "text" | "announcement" | "thread" | "voice" | "stage" | "category" | "forum"

const KIND_BY_TYPE: Record<number, ChannelKind> = {
  0: "text",
  5: "announcement",
  10: "thread",
  11: "thread",
  12: "thread",
  2: "voice",
  13: "stage",
  4: "category",
  15: "forum",
}

const ICON_BY_KIND: Record<ChannelKind, IconComponent> = {
  text: TagIcon,
  announcement: CampaignIcon,
  thread: ChatBubbleIcon,
  voice: VolumeUpIcon,
  stage: PodcastsIcon,
  category: FolderIcon,
  forum: ForumIcon,
}

const DEFAULT_KINDS: ChannelKind[] = ["text", "announcement"]

interface ChannelGroup {
  id: string
  label: string | null
  channels: Channel[]
}

/** Salons filtrés par type, groupés par catégorie parente (ordre `position`). */
function groupChannels(all: Channel[], kinds: ChannelKind[]): ChannelGroup[] {
  const byId = new Map(all.map((c) => [c.id, c]))
  const allowed = all
    .filter((c) => {
      const kind = KIND_BY_TYPE[c.type]
      return kind !== undefined && kinds.includes(kind)
    })
    .sort((a, b) => a.position - b.position)

  const groupOf = (c: Channel): string | null => {
    if (c.type === 4) return null
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined
    // Un fil a pour parent un salon, pas une catégorie : on remonte d'un cran.
    if (parent && parent.type !== 4) return parent.parent_id
    return c.parent_id
  }

  const buckets = new Map<string | null, Channel[]>()
  for (const c of allowed) {
    const key = groupOf(c)
    buckets.set(key, [...(buckets.get(key) ?? []), c])
  }

  const groups: ChannelGroup[] = []
  const loose = buckets.get(null)
  if (loose) groups.push({ id: "__none__", label: null, channels: loose })
  const categories = all.filter((c) => c.type === 4).sort((a, b) => a.position - b.position)
  for (const cat of categories) {
    const list = buckets.get(cat.id)
    if (list) groups.push({ id: cat.id, label: cat.name, channels: list })
  }
  // Catégorie inconnue (supprimée / non listée) : ne rien perdre.
  for (const [key, list] of buckets) {
    if (key !== null && !categories.some((c) => c.id === key)) {
      groups.push({ id: key, label: null, channels: list })
    }
  }
  return groups
}

interface ChannelListProps {
  groups: ChannelGroup[]
  selected: string[]
  /** Valeurs enregistrées qui ne correspondent plus à aucun salon. */
  unknown: string[]
  onSelect: (id: string) => void
  onSelectUnknown: (id: string) => void
  isDisabled: (id: string) => boolean
  none?: { label: string; onSelect: () => void; checked: boolean }
}

function ChannelList({
  groups,
  selected,
  unknown,
  onSelect,
  onSelectUnknown,
  isDisabled,
  none,
}: ChannelListProps) {
  const { t } = useTranslation()
  return (
    <Command>
      <CommandInput placeholder={t("pickers.channel.search")} />
      <CommandList>
        <CommandEmpty>{t("pickers.channel.empty")}</CommandEmpty>
        {none && (
          <CommandGroup>
            <CommandItem
              value="__none__"
              keywords={[none.label]}
              data-checked={none.checked}
              onSelect={none.onSelect}
            >
              <span className="truncate text-muted-foreground">{none.label}</span>
            </CommandItem>
          </CommandGroup>
        )}
        {unknown.length > 0 && (
          <CommandGroup>
            {unknown.map((id) => (
              <CommandItem
                key={id}
                value={`unknown-${id}`}
                data-checked
                onSelect={() => onSelectUnknown(id)}
              >
                <span className="truncate text-muted-foreground">
                  {t("pickers.channel.deleted", { id })}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {groups.map((group) => (
          <CommandGroup key={group.id} heading={group.label ?? undefined}>
            {group.channels.map((c) => {
              const Icon = ICON_BY_KIND[KIND_BY_TYPE[c.type]]
              return (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  keywords={[c.name]}
                  disabled={isDisabled(c.id)}
                  data-checked={selected.includes(c.id)}
                  onSelect={() => onSelect(c.id)}
                >
                  <Icon className="text-muted-foreground" />
                  <span className="truncate">{c.name}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}

interface BaseChannelProps {
  /** Défaut : salons du serveur sélectionné (`useGuildContext`). */
  channels?: Channel[]
  /** Défaut : texte + annonces. */
  types?: ChannelKind[]
  placeholder?: string
  disabled?: boolean
  id?: string
  "aria-invalid"?: boolean
}

export interface ChannelPickerProps extends BaseChannelProps {
  value: string | null
  onChange: (value: string | null) => void
  allowNone?: boolean
  noneLabel?: string
}

function ChannelLabel({ channel }: { channel: Channel }) {
  const Icon = ICON_BY_KIND[KIND_BY_TYPE[channel.type] ?? "text"]
  return (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{channel.name}</span>
    </>
  )
}

export function ChannelPicker({
  value,
  onChange,
  channels,
  types = DEFAULT_KINDS,
  allowNone,
  noneLabel,
  placeholder,
  disabled,
  id,
  "aria-invalid": invalid,
}: ChannelPickerProps) {
  const { t } = useTranslation()
  const ctx = useGuildContext()
  const all = channels ?? ctx.channels
  const [open, setOpen] = React.useState(false)
  const groups = React.useMemo(() => groupChannels(all, types), [all, types])
  const current = value ? all.find((c) => c.id === value) : undefined
  const unknown = value && !current ? [value] : []

  const pick = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }

  let display: React.ReactNode
  if (current) display = <ChannelLabel channel={current} />
  else if (value) {
    display = (
      <span className="truncate text-muted-foreground">{t("pickers.channel.deleted", { id: value })}</span>
    )
  } else {
    display = (
      <span className="truncate text-muted-foreground">
        {noneLabel && allowNone ? noneLabel : (placeholder ?? t("pickers.channel.placeholder"))}
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
      <ChannelList
        groups={groups}
        selected={value ? [value] : []}
        unknown={unknown}
        onSelect={(next) => pick(next)}
        onSelectUnknown={() => pick(null)}
        isDisabled={() => false}
        none={
          allowNone
            ? {
                label: noneLabel ?? t("pickers.channel.none"),
                checked: value === null,
                onSelect: () => pick(null),
              }
            : undefined
        }
      />
    </SinglePickerShell>
  )
}

export interface ChannelMultiPickerProps extends BaseChannelProps {
  value: string[]
  onChange: (value: string[]) => void
  /** Au-delà, les salons non choisis sont désactivés. */
  max?: number
}

export function ChannelMultiPicker({
  value,
  onChange,
  channels,
  types = DEFAULT_KINDS,
  max,
  placeholder,
  disabled,
  id,
  "aria-invalid": invalid,
}: ChannelMultiPickerProps) {
  const { t } = useTranslation()
  const ctx = useGuildContext()
  const all = channels ?? ctx.channels
  const [open, setOpen] = React.useState(false)
  const groups = React.useMemo(() => groupChannels(all, types), [all, types])
  const byId = React.useMemo(() => new Map(all.map((c) => [c.id, c])), [all])
  const unknown = value.filter((v) => !byId.has(v))
  const isFull = max !== undefined && value.length >= max

  const toggle = (channelId: string) =>
    onChange(value.includes(channelId) ? value.filter((v) => v !== channelId) : [...value, channelId])

  const chips = value.map((channelId) => {
    const c = byId.get(channelId)
    return c
      ? { key: channelId, label: c.name, icon: <ChannelChipIcon channel={c} /> }
      : { key: channelId, label: t("pickers.channel.deleted", { id: channelId }), muted: true }
  })

  return (
    <MultiPickerShell
      id={id}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      invalid={invalid}
      chips={chips}
      placeholder={placeholder ?? t("pickers.channel.placeholderMulti")}
      onRemove={toggle}
    >
      <ChannelList
        groups={groups}
        selected={value}
        unknown={unknown}
        onSelect={toggle}
        onSelectUnknown={toggle}
        isDisabled={(channelId) => isFull && !value.includes(channelId)}
      />
    </MultiPickerShell>
  )
}

function ChannelChipIcon({ channel }: { channel: Channel }) {
  const Icon = ICON_BY_KIND[KIND_BY_TYPE[channel.type] ?? "text"]
  return <Icon className="size-3 shrink-0" />
}
