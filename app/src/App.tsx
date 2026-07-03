import { Navigate, Route, Routes } from "react-router-dom"

import { Spinner } from "@/components/ui/spinner"
import { AppShell } from "@/components/layout/app-shell"
import { useViewer } from "@/hooks/useViewer"
import { BlacklistPage } from "@/pages/blacklist-page"
import { CaseDetailView } from "@/components/cases/case-detail-view"
import { LoginPage } from "@/pages/login-page"
import {
  PersonalCaseDetailPage,
  PersonalCasesPage,
} from "@/pages/personal-cases-page"
import {
  ServerCaseDetailPage,
  ServerCasesPage,
  ServersLandingPage,
} from "@/pages/server-cases-page"
import { StaffCaseDetailPage, StaffCasesPage } from "@/pages/staff-cases-page"
import { useParams } from "react-router-dom"

function GlobalCaseDetailPage() {
  const { reference } = useParams()
  return (
    <CaseDetailView identifier={reference!} backTo="/me" backLabel="Mes sanctions" />
  )
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const viewer = useViewer()
  if (!viewer.isStaff) return <Navigate to="/me" replace />
  return <>{children}</>
}

export function App() {
  const viewer = useViewer()

  if (viewer.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  if (viewer.status === "unauthenticated") {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/me" replace />} />

        <Route path="me" element={<PersonalCasesPage />} />
        <Route path="me/:reference" element={<PersonalCaseDetailPage />} />

        <Route path="servers" element={<ServersLandingPage />} />
        <Route path="servers/:guildId" element={<ServerCasesPage />} />
        <Route
          path="servers/:guildId/:reference"
          element={<ServerCaseDetailPage />}
        />

        <Route
          path="staff/cases"
          element={
            <StaffRoute>
              <StaffCasesPage />
            </StaffRoute>
          }
        />
        <Route
          path="staff/cases/:reference"
          element={
            <StaffRoute>
              <StaffCaseDetailPage />
            </StaffRoute>
          }
        />
        <Route
          path="staff/blacklist"
          element={
            <StaffRoute>
              <BlacklistPage />
            </StaffRoute>
          }
        />

        <Route path="cases/:reference" element={<GlobalCaseDetailPage />} />

        <Route path="*" element={<Navigate to="/me" replace />} />
      </Route>
    </Routes>
  )
}

export default App
