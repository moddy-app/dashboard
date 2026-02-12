import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import * as Sentry from "@sentry/react"

import "./index.css"
import App from "./App.tsx"

Sentry.init({
  dsn: "https://68314945d5389aff0aae69966e2e46fb@o4510617959202816.ingest.de.sentry.io/4510875563196496",
  sendDefaultPii: true,
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
