import { RouterProvider } from 'react-router-dom'
import { TaskProvider } from '../components/tasks/TaskProvider'
import { AuthStateProvider } from './auth/AuthStateProvider'
import { router } from './router'
import { ThemeProvider } from './theme/ThemeProvider'

export function App() {
  return (
    <ThemeProvider>
      <AuthStateProvider>
        <TaskProvider>
          <RouterProvider router={router} />
        </TaskProvider>
      </AuthStateProvider>
    </ThemeProvider>
  )
}
