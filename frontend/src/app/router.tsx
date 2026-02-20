import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Layout } from './Layout'
import { RequireAuth } from './RequireAuth'

const LandingPage = lazy(async () => {
  const m = await import('../pages/Landing')
  return { default: m.LandingPage }
})
const ClonePage = lazy(async () => {
  const m = await import('../pages/Clone')
  return { default: m.ClonePage }
})
const GeneratePage = lazy(async () => {
  const m = await import('../pages/Generate')
  return { default: m.GeneratePage }
})
const DesignPage = lazy(async () => {
  const m = await import('../pages/Design')
  return { default: m.DesignPage }
})
const VoicesPage = lazy(async () => {
  const m = await import('../pages/Voices')
  return { default: m.VoicesPage }
})
const HistoryPage = lazy(async () => {
  const m = await import('../pages/History')
  return { default: m.HistoryPage }
})
const AboutPage = lazy(async () => {
  const m = await import('../pages/About')
  return { default: m.AboutPage }
})
const PrivacyPage = lazy(async () => {
  const m = await import('../pages/Privacy')
  return { default: m.PrivacyPage }
})
const TermsPage = lazy(async () => {
  const m = await import('../pages/Terms')
  return { default: m.TermsPage }
})

const AuthPage = lazy(async () => {
  const m = await import('../pages/Auth')
  return { default: m.AuthPage }
})
const AccountLayoutPage = lazy(async () => {
  const m = await import('../pages/account/AccountLayout')
  return { default: m.AccountLayoutPage }
})
const AccountProfilePage = lazy(async () => {
  const m = await import('../pages/account/Profile')
  return { default: m.AccountProfilePage }
})
const AccountUsagePage = lazy(async () => {
  const m = await import('../pages/account/Usage')
  return { default: m.AccountUsagePage }
})
const AccountBillingPage = lazy(async () => {
  const m = await import('../pages/account/Billing')
  return { default: m.AccountBillingPage }
})

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <LandingPage /> },
      {
        path: '/clone',
        element: (
          <RequireAuth>
            <ClonePage />
          </RequireAuth>
        ),
      },
      {
        path: '/generate',
        element: (
          <RequireAuth>
            <GeneratePage />
          </RequireAuth>
        ),
      },
      {
        path: '/design',
        element: (
          <RequireAuth>
            <DesignPage />
          </RequireAuth>
        ),
      },
      {
        path: '/voices',
        element: (
          <RequireAuth>
            <VoicesPage />
          </RequireAuth>
        ),
      },
      {
        path: '/history',
        element: (
          <RequireAuth>
            <HistoryPage />
          </RequireAuth>
        ),
      },
      { path: '/auth', element: <AuthPage /> },
      { path: '/pricing', element: <Navigate to="/#pricing" replace /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '/terms', element: <TermsPage /> },
      {
        path: '/account',
        element: (
          <RequireAuth>
            <AccountLayoutPage />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Navigate to="/account/profile" replace /> },
          { path: 'auth', element: <Navigate to="/auth" replace /> },
          { path: 'profile', element: <AccountProfilePage /> },
          { path: 'usage', element: <AccountUsagePage /> },
          { path: 'billing', element: <AccountBillingPage /> },
        ],
      },
      { path: '/about', element: <AboutPage /> },
    ],
  },
])
