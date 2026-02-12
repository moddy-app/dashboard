import { useState, useEffect } from 'react'
import { verifySession, getUserInfo, type User, type UserInfo } from '@/lib/auth'

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User; userInfo: UserInfo | null }
  | { status: 'unauthenticated' }

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    async function checkAuth() {
      console.log('[useAuth] Starting auth check...')
      const result = await verifySession()
      console.log('[useAuth] verifySession result:', result)

      if (result.valid && result.discord_id) {
        console.log('[useAuth] Session is valid, fetching user info...')
        // Récupérer les informations complètes de l'utilisateur
        const userInfo = await getUserInfo()
        console.log('[useAuth] getUserInfo result:', userInfo)

        setState({
          status: 'authenticated',
          user: {
            discord_id: result.discord_id,
            email: result.email || null,
          },
          userInfo,
        })
        console.log('[useAuth] State set to authenticated')
      } else {
        console.log('[useAuth] Session is invalid or discord_id missing')
        console.log('[useAuth] result.valid:', result.valid)
        console.log('[useAuth] result.discord_id:', result.discord_id)
        setState({ status: 'unauthenticated' })
      }
    }

    checkAuth()
  }, [])

  return state
}
