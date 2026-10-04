import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../../src/auth/AuthProvider'
import { EditorPage } from '../../src/pages/EditorPage'
import { fakeClient } from './fakeClient'

describe('/edit/:id', () => {
  it('shows not-found for an id that is not a UUID, without querying the server', async () => {
    const f = fakeClient()
    render(
      <MemoryRouter initialEntries={['/edit/not-a-uuid']}>
        <AuthProvider client={f.client}>
          <Routes><Route path="/edit/:id" element={<EditorPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'Board not found' })).toBeInTheDocument()
    expect(f.client.from).not.toHaveBeenCalled()
  })
})
