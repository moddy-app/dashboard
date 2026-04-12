import { Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { DebugPage } from '@/pages/DebugPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/debug" element={<DebugPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
