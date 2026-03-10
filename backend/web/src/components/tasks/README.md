# Task Management Components

A set of React components for building kanban boards and task lists with drag-and-drop functionality.

## Components

### KanbanBoard
A full-featured kanban board with drag-and-drop support using @dnd-kit.

**Features:**
- Drag and drop tasks between columns
- Visual feedback during dragging
- Task count per column
- Responsive grid layout (1-4 columns based on screen size)
- Status-based column styling

**Props:**
- `initialTasks?: Task[]` - Array of tasks to display
- `onTaskUpdate?: (taskId: string, newStatus: Task['status']) => void` - Callback when task status changes

**Example:**
```tsx
import { KanbanBoard } from './components/tasks';

function App() {
  const tasks = [
    { id: '1', title: 'Task 1', status: 'Todo' },
    { id: '2', title: 'Task 2', status: 'InProgress' },
  ];

  return <KanbanBoard initialTasks={tasks} />;
}
```

### TaskAccordion
A collapsible accordion-style task list grouped by status.

**Features:**
- Tasks grouped by status in expandable sections
- Status badges with color coding
- Priority indicators
- Assignee display
- Click handlers for task interaction
- Task counts per status

**Props:**
- `tasks: Task[]` - Array of tasks to display
- `onTaskClick?: (task: Task) => void` - Callback when a task is clicked

**Example:**
```tsx
import { TaskAccordion } from './components/tasks';

function App() {
  const tasks = [
    { id: '1', title: 'Task 1', status: 'Todo', priority: 'high' },
    { id: '2', title: 'Task 2', status: 'InProgress', priority: 'medium' },
  ];

  return (
    <TaskAccordion 
      tasks={tasks}
      onTaskClick={(task) => console.log(task)}
    />
  );
}
```

## Task Interface

```typescript
interface Task {
  id: string;                    // Unique identifier
  title: string;                 // Task title
  description?: string;          // Optional description
  status: 'Todo' | 'InProgress' | 'Review' | 'Done';  // Task status
  assignee?: string;             // Optional assignee name
  priority?: 'low' | 'medium' | 'high';  // Optional priority
  createdAt?: string;            // ISO timestamp
  updatedAt?: string;            // ISO timestamp
}
```

## Styling

Components use Tailwind CSS classes and include:

### Status Colors
- **Todo**: Gray border and background
- **InProgress**: Blue border and background
- **Review**: Yellow border and background
- **Done**: Green border and background

### Priority Colors
- **Low**: Green badge
- **Medium**: Yellow badge
- **High**: Red badge

## Dependencies

- `@dnd-kit/core` - Core drag-and-drop functionality
- `@dnd-kit/sortable` - Sortable lists
- `@dnd-kit/utilities` - Utility functions
- `react` - React library
- `tailwindcss` - Styling

## Installation

The required packages are already installed in your project:

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Usage Examples

See `TaskExample.tsx` for a complete working example with sample data.

## File Structure

```
src/components/tasks/
├── index.ts           # Export all components
├── KanbanBoard.tsx    # Main kanban board component
├── KanbanColumn.tsx   # Individual column component
├── TaskCard.tsx       # Draggable task card component
├── TaskAccordion.tsx  # Accordion-style task list
├── TaskExample.tsx    # Usage examples
└── README.md          # This file
```

## Features Implemented

### Step 1: KanbanBoard with Drag & Drop
- [x] DndContext setup with collision detection
- [x] DragStart and DragEnd event handlers
- [x] Task status updates on drop
- [x] DragOverlay for visual feedback
- [x] Four-column layout (Todo, InProgress, Review, Done)
- [x] Responsive grid (1-4 columns)

### Step 2: TaskAccordion Component
- [x] Expandable/collapsible task groups
- [x] Tasks grouped by status
- [x] Status badges with color coding
- [x] Priority indicators
- [x] Click handlers for task interaction
- [x] Task counts per status
- [x] Assignee and date display

## Future Enhancements

Potential improvements:
- Task editing functionality
- Task creation UI
- Filtering and searching
- Task sorting options
- Keyboard navigation
- Accessibility improvements (ARIA labels)
- Persistent storage (localStorage/API)
- Task dependencies
- Subtasks
- Comments/attachments
- Due dates and reminders
