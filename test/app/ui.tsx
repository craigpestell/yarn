import { render } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthProvider } from '../../src/auth/AuthProvider'
import { RequireAuth } from '../../src/auth/RequireAuth'
import { AccountPage } from '../../src/pages/AccountPage'
import { BoardsPage } from '../../src/pages/BoardsPage'
import { LoginPage } from '../../src/pages/LoginPage'
import { RegisterPage } from '../../src/pages/RegisterPage'
import { ResetPage } from '../../src/pages/ResetPage'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

/** Renders the real auth-related routes against a fake client. */
export function renderApp(client: SupabaseClient, path: string, extra?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider client={client}>
        <Routes>
          <Route path="/" element={<main>sandbox</main>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset" element={<ResetPage />} />
          <Route path="/boards" element={<RequireAuth><BoardsPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          <Route path="/edit/:id" element={<main>editor</main>} />
        </Routes>
        <Where />
        {extra}
      </AuthProvider>
    </MemoryRouter>,
  )
}
