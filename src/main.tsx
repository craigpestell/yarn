import '@fontsource/permanent-marker/latin-400.css'
import '@fontsource/special-elite/latin-400.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { getSupabase } from './lib/supabase'
import { createAppRouter } from './routes'
import './styles.css'
import './tailwind.css'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')
createRoot(root).render(
  <StrictMode>
    <AuthProvider client={getSupabase()}>
      <RouterProvider router={createAppRouter()} />
    </AuthProvider>
  </StrictMode>,
)
