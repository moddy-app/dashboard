import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom"
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
import { WelcomeDmPage } from "@/pages/modules/WelcomeDmPage"
import { AutoRolePage } from "@/pages/modules/AutoRolePage"
import { AdaptiveSlowmodePage } from "@/pages/modules/AdaptiveSlowmodePage"
import { SocialNotificationsPage } from "@/pages/modules/SocialNotificationsPage"
import { AutomodAiPage } from "@/pages/modules/AutomodAiPage"
import { BotCustomizationPage } from "@/pages/modules/BotCustomizationPage"
import { AltGuardPage } from "@/pages/modules/AltGuardPage"
import { LogsPage } from "@/pages/modules/LogsPage"
import { TicketsPage } from "@/pages/modules/TicketsPage"
import { StaffPage } from "@/pages/StaffPage"
import { PremiumPage } from "@/pages/PremiumPage"
import { MyCasesPage } from "@/pages/MyCasesPage"
import { ViolationsPage } from "@/pages/ViolationsPage"
import { GuildCasesPage } from "@/pages/GuildCasesPage"
import { GuildSettingsPage } from "@/pages/GuildSettingsPage"
import { BrocoliPage } from "@/pages/BrocoliPage"
import { RouteError } from "@/components/route-error"

Sentry.init({
  dsn: "https://68314945d5389aff0aae69966e2e46fb@o4510617959202816.ingest.de.sentry.io/4510875563196496",
  sendDefaultPii: true,
})

// createBrowserRouter (data router) — requis pour useBlocker et les futures loaders
const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <GuildSelectionView /> },
      { path: "cases", element: <MyCasesPage /> },
      { path: "violations", element: <ViolationsPage /> },
      { path: "servers/:guildId", element: <GuildOverviewPage /> },
      { path: "servers/:guildId/cases", element: <GuildCasesPage /> },
      { path: "servers/:guildId/settings", element: <GuildSettingsPage /> },
      { path: "servers/:guildId/brocoli", element: <BrocoliPage /> },
      { path: "servers/:guildId/modules/starboard", element: <StarboardPage /> },
      { path: "servers/:guildId/modules/welcome_channel", element: <WelcomeChannelPage /> },
      { path: "servers/:guildId/modules/welcome_dm", element: <WelcomeDmPage /> },
      { path: "servers/:guildId/modules/auto_role", element: <AutoRolePage /> },
      // Ancien module `logging`, retiré : les liens existants basculent sur `logs`.
      { path: "servers/:guildId/modules/logging", element: <Navigate to="../logs" replace /> },
      { path: "servers/:guildId/modules/adaptive_slowmode", element: <AdaptiveSlowmodePage /> },
      { path: "servers/:guildId/modules/social_notifications", element: <SocialNotificationsPage /> },
      { path: "servers/:guildId/modules/automod_ai", element: <AutomodAiPage /> },
      { path: "servers/:guildId/modules/bot_customization", element: <BotCustomizationPage /> },
      { path: "servers/:guildId/modules/altguard", element: <AltGuardPage /> },
      { path: "servers/:guildId/modules/logs", element: <LogsPage /> },
      { path: "servers/:guildId/modules/tickets", element: <TicketsPage /> },
      { path: "staff", element: <StaffPage /> },
      { path: "premium", element: <PremiumPage /> },
      { path: "select-premium-servers", element: <Navigate to="/?openSettings=billing" replace /> },
    ],
  },
  { path: "/debug", element: <DebugPage />, errorElement: <RouteError /> },
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
