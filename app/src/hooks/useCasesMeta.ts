import * as React from "react"

import { getCasesMeta } from "@/services/cases"
import type { CasesMeta } from "@/services/cases-types"

let cached: CasesMeta | null = null
let inflight: Promise<CasesMeta> | null = null

export function useCasesMeta() {
  const [meta, setMeta] = React.useState<CasesMeta | null>(cached)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (cached) return
    let active = true
    if (!inflight) inflight = getCasesMeta()
    inflight
      .then((data) => {
        cached = data
        if (active) setMeta(data)
      })
      .catch((err: Error) => {
        inflight = null
        if (active) setError(err)
      })
    return () => {
      active = false
    }
  }, [])

  return { meta, error, loading: !meta && !error }
}
