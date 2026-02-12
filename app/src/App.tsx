import { Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { DebugPage } from '@/pages/DebugPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/debug" element={<DebugPage />} />
    </Routes>
  )
}

export default App
