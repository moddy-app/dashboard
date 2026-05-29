const API_BASE = import.meta.env.VITE_API_URL ?? 'https://api.moddy.app'

export type BannerType =
  | 'announcement'
  | 'incident'
  | 'maintenance'
  | 'information'
  | 'warning'
  | 'resolved'

export interface Banner {
  id: number
  message: string
  type: BannerType | null
  icon_svg: string | null
  color: string | null
  show_dashboard: boolean
  show_website: boolean
  is_active: boolean
  updated_at: string
}

export async function getActiveBanner(): Promise<Banner | null> {
  try {
    const res = await fetch(`${API_BASE}/banners/active`)
    if (!res.ok) return null
    const data: Banner | null = await res.json()
    return data ?? null
  } catch {
    return null
  }
}
