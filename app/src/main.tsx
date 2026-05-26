import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider } from "react-router-dom"
import * as Sentry from "@sentry/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

import "./index.css"
import "./i18n"

// Pages (lazy-safe imports)
import { HomePage } from "@/pages/HomePage"
import { DebugPage } from "@/pages/DebugPage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { GuildOverviewPage } from "@/pages/GuildOverviewPage"
import { GuildSelectionView } from "@/pages/GuildSelectionView"
import { StarboardPage } from "@/pages/modules/StarboardPage"
import { WelcomeChannelPage } from "@/pages/modules/WelcomeChannelPage"
import { AutoRolePage } from "@/pages/modules/AutoRolePage"
import { LoggingPage } from "@/pages/modules/LoggingPage"
import { StaffPage } from "@/pages/StaffPage"
import { PremiumPage } from "@/pages/PremiumPage"
import { BillingPage } from "@/pages/BillingPage"

Sentry.init({
  dsn: "https://68314945d5389aff0aae69966e2e46fb@o4510617959202816.ingest.de.sentry.io/4510875563196496",
  sendDefaultPii: true,
})

// createBrowserRouter (data router) — requis pour useBlocker et les futures loaders
const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
    children: [
      { index: true, element: <GuildSelectionView /> },
      { path: "servers/:guildId", element: <GuildOverviewPage /> },
      { path: "servers/:guildId/modules/starboard", element: <StarboardPage /> },
      { path: "servers/:guildId/modules/welcome_channel", element: <WelcomeChannelPage /> },
      { path: "servers/:guildId/modules/auto_role", element: <AutoRolePage /> },
      { path: "servers/:guildId/modules/logging", element: <LoggingPage /> },
      { path: "staff", element: <StaffPage /> },
      { path: "premium", element: <PremiumPage /> },
      { path: "billing", element: <BillingPage /> },
    ],
  },
  { path: "/debug", element: <DebugPage /> },
  { path: "*", element: <NotFoundPage /> },
])

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system">
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
