import { TaskPriority } from '@types'

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-slate-700 text-slate-300',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-red-500/20 text-red-400'
}

export const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-700 text-slate-300',
  in_progress: 'bg-blue-500/20 text-blue-400',
  review: 'bg-amber-500/20 text-amber-400',
  done: 'bg-emerald-500/20 text-emerald-400'
}
