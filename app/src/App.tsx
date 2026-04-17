import { Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { DebugPage } from '@/pages/DebugPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { GuildOverviewPage } from '@/pages/GuildOverviewPage'
import { GuildSelectionView } from '@/pages/GuildSelectionView'
import { StarboardPage } from '@/pages/modules/StarboardPage'
import { WelcomeChannelPage } from '@/pages/modules/WelcomeChannelPage'
import { AutoRolePage } from '@/pages/modules/AutoRolePage'
import { LoggingPage } from '@/pages/modules/LoggingPage'
import { StaffPage } from '@/pages/StaffPage'

export function App() {
  return (
    <Routes>
      {/* Routes auth-guardées — HomePage est le layout avec sidebar */}
      <Route path="/" element={<HomePage />}>
        <Route index element={<GuildSelectionView />} />
        <Route path="servers/:guildId" element={<GuildOverviewPage />} />
        <Route path="servers/:guildId/modules/starboard" element={<StarboardPage />} />
        <Route path="servers/:guildId/modules/welcome_channel" element={<WelcomeChannelPage />} />
        <Route path="servers/:guildId/modules/auto_role" element={<AutoRolePage />} />
        <Route path="servers/:guildId/modules/logging" element={<LoggingPage />} />
        <Route path="staff" element={<StaffPage />} />
      </Route>
      {/* Routes publiques */}
      <Route path="/debug" element={<DebugPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
