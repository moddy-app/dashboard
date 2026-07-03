import * as React from "react"

import { getGuildProfile, getUserProfile } from "@/services/cases"
import type { GuildProfile, UserProfile } from "@/services/cases-types"

type Entry<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: Error }

type ProfileCache = {
  users: Map<string, Entry<UserProfile>>
  guilds: Map<string, Entry<GuildProfile>>
  userPromises: Map<string, Promise<unknown>>
  guildPromises: Map<string, Promise<unknown>>
  subscribe: (cb: () => void) => () => void
  emit: () => void
}

const ProfileCacheContext = React.createContext<ProfileCache | null>(null)

function createCache(): ProfileCache {
  const listeners = new Set<() => void>()
  return {
    users: new Map(),
    guilds: new Map(),
    userPromises: new Map(),
    guildPromises: new Map(),
    subscribe: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    emit: () => listeners.forEach((cb) => cb()),
  }
}

export function ProfileCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache] = React.useState(createCache)
  return (
    <ProfileCacheContext.Provider value={cache}>
      {children}
    </ProfileCacheContext.Provider>
  )
}

function useCache() {
  const cache = React.useContext(ProfileCacheContext)
  if (!cache)
    throw new Error("useProfiles must be used within ProfileCacheProvider")
  const [, force] = React.useReducer((n) => n + 1, 0)
  React.useEffect(() => cache.subscribe(force), [cache])
  return cache
}

export function useUserProfile(userId: string | null | undefined) {
  const cache = useCache()

  React.useEffect(() => {
    if (!userId) return
    if (cache.users.has(userId) || cache.userPromises.has(userId)) return
    cache.users.set(userId, { status: "loading", data: null, error: null })
    const p = getUserProfile(userId)
      .then((data) => {
        cache.users.set(userId, { status: "success", data, error: null })
      })
      .catch((error: Error) => {
        cache.users.set(userId, { status: "error", data: null, error })
      })
      .finally(() => {
        cache.userPromises.delete(userId)
        cache.emit()
      })
    cache.userPromises.set(userId, p)
    cache.emit()
  }, [cache, userId])

  return userId
    ? cache.users.get(userId) ?? { status: "loading", data: null, error: null }
    : ({ status: "loading", data: null, error: null } as Entry<UserProfile>)
}

export function useGuildProfile(guildId: string | null | undefined) {
  const cache = useCache()

  React.useEffect(() => {
    if (!guildId) return
    if (cache.guilds.has(guildId) || cache.guildPromises.has(guildId)) return
    cache.guilds.set(guildId, { status: "loading", data: null, error: null })
    const p = getGuildProfile(guildId)
      .then((data) => {
        cache.guilds.set(guildId, { status: "success", data, error: null })
      })
      .catch((error: Error) => {
        cache.guilds.set(guildId, { status: "error", data: null, error })
      })
      .finally(() => {
        cache.guildPromises.delete(guildId)
        cache.emit()
      })
    cache.guildPromises.set(guildId, p)
    cache.emit()
  }, [cache, guildId])

  return guildId
    ? cache.guilds.get(guildId) ??
        { status: "loading", data: null, error: null }
    : ({ status: "loading", data: null, error: null } as Entry<GuildProfile>)
}
