import { useState, useEffect } from 'react'
import { getMe, type User } from '@/lib/auth'

type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    getMe()
      .then(user => {
        if (user) {
          setState({ status: 'authenticated', user })
        } else {
          setState({ status: 'unauthenticated' })
        }
      })
      .catch(() => {
        setState({ status: 'unauthenticated' })
      })
  }, [])

  return state
}
