import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import * as Sentry from "@sentry/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

import "./index.css"
import "./i18n"
import App from "./App.tsx"

Sentry.init({
  dsn: "https://68314945d5389aff0aae69966e2e46fb@o4510617959202816.ingest.de.sentry.io/4510875563196496",
  sendDefaultPii: true,
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system">
        <TooltipProvider>
          <App />
          <Toaster position="bottom-right" richColors />
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
