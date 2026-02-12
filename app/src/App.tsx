import { Routes, Route, Navigate } from 'react-router-dom'
import { DebugPage } from '@/pages/DebugPage'

export function App() {
  return (
    <Routes>
      <Route path="/debug" element={<DebugPage />} />
      <Route path="*" element={<Navigate to="/debug" replace />} />
    </Routes>
  )
}

export default App
