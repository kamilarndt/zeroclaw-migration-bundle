# Custom Hooks

This directory contains custom React hooks for the ZeroClaw web application.

## useInitialHandState

Hook to fetch initial hand state from the server on mount and hydrate the UI store with both server and localStorage data.

### Usage

```tsx
import { useInitialHandState } from '../hooks/useInitialHandState';
import { useUiStore } from '../lib/store';

function MyComponent() {
  // Fetch initial state on mount
  useInitialHandState();

  // Access store state
  const { hands, tasks, isLoading, error } = useUiStore();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Hands</h2>
      <ul>
        {hands.map(hand => (
          <li key={hand.id}>{hand.name} ({hand.status})</li>
        ))}
      </ul>

      <h2>Tasks</h2>
      <ul>
        {tasks.map(task => (
          <li key={task.id}>{task.title} ({task.status})</li>
        ))}
      </ul>
    </div>
  );
}
```

### Features

- Fetches `/api/status` on component mount
- Hydrates the UI store with server data
- Merges server state with localStorage state
- Auto-persists state changes to localStorage
- Handles errors gracefully with fallback to localStorage
- Supports cancellation on unmount

### Store API

#### State

- `tasks: Task[]` - List of tasks
- `hands: Hand[]` - List of hands
- `isLoading: boolean` - Loading state for initial data fetch
- `error: string | null` - Error state for initial data fetch

#### Actions

- `setTasks(tasks: Task[])` - Set the list of tasks
- `setHands(hands: Hand[])` - Set the list of hands
- `addTask(task: Task)` - Add a new task
- `updateTask(id: string, updates: Partial<Task>)` - Update an existing task
- `removeTask(id: string)` - Remove a task
- `addHand(hand: Hand)` - Add a new hand
- `updateHand(id: string, updates: Partial<Hand>)` - Update an existing hand
- `removeHand(id: string)` - Remove a hand
- `hydrate(state: Partial<UiStoreState>)` - Hydrate state from storage
- `persist()` - Persist current state to storage
- `setLoading(loading: boolean)` - Set loading state
- `setError(error: string | null)` - Set error state

### Provider Setup

Wrap your application with the `UiStoreProvider`:

```tsx
import { UiStoreProvider } from './lib/store';

function App() {
  return (
    <UiStoreProvider>
      <YourAppComponents />
    </UiStoreProvider>
  );
}
```

### Selectors

For optimal performance, you can use the `useUiStoreSelector` hook to subscribe to specific parts of the state:

```tsx
import { useUiStoreSelector } from '../lib/store';

function TaskList() {
  // Only re-renders when tasks change
  const tasks = useUiStoreSelector(state => state.tasks);

  return (
    <ul>
      {tasks.map(task => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  );
}
```
