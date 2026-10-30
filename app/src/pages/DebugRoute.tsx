import { lazy, Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/spinner'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Chargée à la demande : le module de `DebugPage` intercepte `console.*` dès
// son import. Importé statiquement, il le faisait pour tout le monde, sur
// toutes les pages, et gardait en mémoire les corps de réponse journalisés.
const DebugPage = lazy(() => import('@/pages/DebugPage').then((m) => ({ default: m.DebugPage })))

function Loading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner />
    </div>
  )
}

/**
 * `/debug` n'existe qu'en développement et pour le staff. Pour les autres,
 * la route se comporte comme une page inexistante.
 */
export function DebugRoute() {
  const auth = useAuth()
  const allowed =
    import.meta.env.DEV || (auth.status === 'authenticated' && auth.user.is_staff)

  if (!import.meta.env.DEV && auth.status === 'loading') return <Loading />
  if (!allowed) return <NotFoundPage />

  return (
    <Suspense fallback={<Loading />}>
      <DebugPage />
    </Suspense>
  )
}
