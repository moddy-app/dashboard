import { useState, useEffect } from 'react'
import { verifySession, type User } from '@/lib/auth'

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    async function checkAuth() {
      const result = await verifySession()

      if (result.valid && result.discord_id) {
        setState({
          status: 'authenticated',
          user: {
            discord_id: result.discord_id,
            email: result.email || null,
          },
        })
      } else {
        setState({ status: 'unauthenticated' })
      }
    }

    checkAuth()
  }, [])

  return state
}
