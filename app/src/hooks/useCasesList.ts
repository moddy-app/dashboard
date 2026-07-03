import * as React from "react"

import { listCases } from "@/services/cases"
import type { CaseListItem, CasesQuery } from "@/services/cases-types"

const PAGE_SIZE = 50

type State = {
  items: CaseListItem[]
  status: "loading" | "success" | "error"
  error: Error | null
  hasMore: boolean
  loadingMore: boolean
}

/**
 * Liste paginée « offset-based » avec chargement incrémental.
 * Conçue pour tenir des milliers de cases : on ne demande au serveur
 * qu'une page à la fois et la vue virtualise le rendu.
 */
export function useCasesList(query: CasesQuery) {
  const [state, setState] = React.useState<State>({
    items: [],
    status: "loading",
    error: null,
    hasMore: false,
    loadingMore: false,
  })

  // Sérialise la query pour un effet stable.
  const key = React.useMemo(() => JSON.stringify(query), [query])
  const reqId = React.useRef(0)

  const fetchPage = React.useCallback(
    async (offset: number) => {
      const id = ++reqId.current
      try {
        const page = await listCases({
          ...query,
          limit: PAGE_SIZE,
          offset,
        })
        if (id !== reqId.current) return
        setState((prev) => {
          const items =
            offset === 0 ? page : [...prev.items, ...page]
          return {
            items,
            status: "success",
            error: null,
            hasMore: page.length === PAGE_SIZE,
            loadingMore: false,
          }
        })
      } catch (error) {
        if (id !== reqId.current) return
        setState((prev) => ({
          ...prev,
          status: prev.items.length ? "success" : "error",
          error: error as Error,
          loadingMore: false,
        }))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  )

  React.useEffect(() => {
    setState({
      items: [],
      status: "loading",
      error: null,
      hasMore: false,
      loadingMore: false,
    })
    fetchPage(0)
  }, [fetchPage])

  const loadMore = React.useCallback(() => {
    setState((prev) => {
      if (prev.loadingMore || !prev.hasMore) return prev
      fetchPage(prev.items.length)
      return { ...prev, loadingMore: true }
    })
  }, [fetchPage])

  const refetch = React.useCallback(() => {
    fetchPage(0)
  }, [fetchPage])

  return { ...state, loadMore, refetch }
}
