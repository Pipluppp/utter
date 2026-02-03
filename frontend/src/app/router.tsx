import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'

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

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/clone', element: <ClonePage /> },
      { path: '/generate', element: <GeneratePage /> },
      { path: '/design', element: <DesignPage /> },
      { path: '/voices', element: <VoicesPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: '/about', element: <AboutPage /> },
    ],
  },
])
