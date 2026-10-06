import { createBrowserRouter, type RouteObject } from 'react-router'
import { Layout } from './pages/Footer'
import { RequireAuth } from './auth/RequireAuth'
import { AccountPage } from './pages/AccountPage'
import { BoardsPage } from './pages/BoardsPage'
import { EditorPage } from './pages/EditorPage'
import { ExplorePage } from './pages/ExplorePage'
import { ReaderPage } from './pages/ReaderPage'
import { TopicPage } from './pages/TopicPage'
import { TopicsPage } from './pages/TopicsPage'
import { PrivacyPage, TermsPage } from './pages/LegalPages'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ResetPage } from './pages/ResetPage'
import { SandboxPage } from './pages/SandboxPage'

/** A data router (not <BrowserRouter>) because the editor uses useBlocker to guard unsaved edits. */
export const routeObjects: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <SandboxPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/reset', element: <ResetPage /> },
      { path: '/boards', element: <RequireAuth><BoardsPage /></RequireAuth> },
      { path: '/account', element: <RequireAuth><AccountPage /></RequireAuth> },
      { path: '/edit/:id', element: <RequireAuth><EditorPage /></RequireAuth> },
      { path: '/b/:slug', element: <ReaderPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/terms', element: <TermsPage /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/topics', element: <TopicsPage /> },
      { path: '/topics/:slug', element: <TopicPage /> },
      { path: '*', element: <main className="page"><h1>Not found</h1><a href="/">Home</a></main> },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routeObjects)
