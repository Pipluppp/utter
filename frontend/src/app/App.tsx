import { RouterProvider } from 'react-router-dom'
import { TaskProvider } from '../components/tasks/TaskProvider'
import { router } from './router'

export function App() {
  return (
    <TaskProvider>
      <RouterProvider router={router} />
    </TaskProvider>
  )
}

