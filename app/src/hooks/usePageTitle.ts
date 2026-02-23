import { useEffect } from 'react'

export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = `Moddy Dashboard - ${page}`
    return () => {
      document.title = 'Moddy Dashboard'
    }
  }, [page])
}
