import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "./index.css"
import App from "./App.tsx"
import { ToastProvider } from "@/components/ui/toast"
import { ProfileCacheProvider } from "@/hooks/useProfiles"
import { ViewerProvider } from "@/hooks/useViewer"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ViewerProvider>
        <ProfileCacheProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ProfileCacheProvider>
      </ViewerProvider>
    </BrowserRouter>
  </StrictMode>
)
