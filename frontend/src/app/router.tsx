import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'
import { AboutPage } from '../pages/About'
import { ClonePage } from '../pages/Clone'
import { DesignPage } from '../pages/Design'
import { GeneratePage } from '../pages/Generate'
import { HistoryPage } from '../pages/History'
import { LandingPage } from '../pages/Landing'
import { VoicesPage } from '../pages/Voices'

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

