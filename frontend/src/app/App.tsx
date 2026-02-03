import { RouterProvider } from 'react-router-dom'
import { TaskProvider } from '../components/tasks/TaskProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import { router } from './router'

export function App() {
  return (
    <ThemeProvider>
      <TaskProvider>
        <RouterProvider router={router} />
      </TaskProvider>
    </ThemeProvider>
  )
}
