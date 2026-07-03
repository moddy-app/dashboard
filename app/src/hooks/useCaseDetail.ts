import * as React from "react"

import { getCase } from "@/services/cases"
import type { ApiError, CaseDetail } from "@/services/cases-types"

type State = {
  data: CaseDetail | null
  status: "loading" | "success" | "error"
  error: ApiError | null
}

export function useCaseDetail(identifier: string | undefined) {
  const [state, setState] = React.useState<State>({
    data: null,
    status: "loading",
    error: null,
  })

  const load = React.useCallback(async () => {
    if (!identifier) return
    try {
      const data = await getCase(identifier)
      setState({ data, status: "success", error: null })
    } catch (error) {
      setState((prev) => ({
        data: prev.data,
        status: "error",
        error: error as ApiError,
      }))
    }
  }, [identifier])

  React.useEffect(() => {
    setState({ data: null, status: "loading", error: null })
    load()
  }, [load])

  // Permet d'injecter la réponse fraîche renvoyée par les mutations
  // (POST/PATCH renvoient le case complet) sans re-fetch.
  const setData = React.useCallback((data: CaseDetail) => {
    setState({ data, status: "success", error: null })
  }, [])

  return { ...state, reload: load, setData }
}
