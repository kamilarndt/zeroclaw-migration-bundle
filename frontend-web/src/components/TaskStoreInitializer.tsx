import { useEffect } from 'react'
import { useTaskStore } from '../stores/taskStore'
import { useAuth } from '../hooks/useAuth'

interface TaskStoreInitializerProps {
  children: React.ReactNode
}

export function TaskStoreInitializer({ children }: TaskStoreInitializerProps) {
  const { fetchTasks } = useTaskStore()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks().catch(err => {
        console.error('Failed to fetch tasks:', err)
      })
    }
  }, [isAuthenticated, fetchTasks])

  return <>{children}</>
}