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
      const result = await verifySession()

      if (result.valid && result.discord_id) {
        // Récupérer les informations complètes de l'utilisateur
        const userInfo = await getUserInfo()

        setState({
          status: 'authenticated',
          user: {
            discord_id: result.discord_id,
            email: result.email || null,
          },
          userInfo,
        })
      } else {
        setState({ status: 'unauthenticated' })
      }
    }

    checkAuth()
  }, [])

  return state
}
