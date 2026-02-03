import { RouterProvider } from 'react-router-dom'
import { TaskProvider } from '../components/tasks/TaskProvider'
import { router } from './router'
import { ThemeProvider } from './theme/ThemeProvider'

export function App() {
  return (
    <ThemeProvider>
      <TaskProvider>
        <RouterProvider router={router} />
      </TaskProvider>
    </ThemeProvider>
  )
}
