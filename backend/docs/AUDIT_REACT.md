# ZeroClaw React Frontend Audit - Memory Leaks & Performance Issues

> **Date:** 2026-03-10
> **Auditor:** Claude Code
> **Scope:** React web dashboard (`~/.zeroclaw/workspace/web/src/`)
> **Focus:** Memory leaks, WebSocket cleanup, large graph rendering

---

## Executive Summary

This audit identifies memory leaks and performance issues in the ZeroClaw React web dashboard. The primary concerns are:

1. **WebSocket cleanup** - Generally well-implemented with proper useEffect cleanup
2. **setTimeout/setInterval management** - Mixed; some missing cleanup
3. **Object URL memory leaks** - **CRITICAL** - File attachment URLs never revoked
4. **Large graph rendering** - No ForceGraph implementation found (placeholder only)
5. **Event listener cleanup** - Generally good

**Overall Assessment:** **MODERATE RISK** - One critical memory leak (Object URLs), otherwise mostly safe patterns.

---

## Critical Vulnerabilities (CRITICAL - MEMORY LEAK)

### 1. Object URL Memory Leak - File Attachments

#### File: `src/pages/AgentChat.tsx:73-86`

```typescript
const handleSendMessage = async (content: string, attachments?: File[], audioData?: ArrayBuffer) => {
  const userMessage: ChatMessageType = {
    id: Date.now().toString(),
    role: 'user',
    content,
    timestamp: Date.now(),
    attachments: attachments?.map(file => ({
      id: Date.now().toString() + Math.random(),
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file)  // ⚠️ NEVER REVOKED
    }))
  }

  setMessages(prev => [...prev, userMessage])
  // ...
}
```

**VULNERABILITY:** `URL.createObjectURL()` creates a blob URL that **must be revoked** with `URL.revokeObjectURL()` to free memory. This code never revokes the URLs.

**Impact:**
- Each attached file leaks memory equal to the file size
- In a long session with many file attachments, this can consume hundreds of MB
- Browser cannot garbage collect the blob data

**Fix:**
```typescript
// Revoke URLs when component unmounts or messages are cleared
useEffect(() => {
  return () => {
    messages.forEach(msg => {
      msg.attachments?.forEach(att => {
        if (att.url.startsWith('blob:')) {
          URL.revokeObjectURL(att.url)
        }
      })
    })
  }
}, [messages])

// Or revoke individually after sending
const handleSendMessage = async (content: string, attachments?: File[], audioData?: ArrayBuffer) => {
  const objectUrls: string[] = []

  const userMessage: ChatMessageType = {
    id: Date.now().toString(),
    role: 'user',
    content,
    timestamp: Date.now(),
    attachments: attachments?.map(file => {
      const url = URL.createObjectURL(file)
      objectUrls.push(url)
      return {
        id: Date.now().toString() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        url
      }
    })
  }

  setMessages(prev => [...prev, userMessage])
  setIsStreaming(true)

  // Send message
  send({
    type: 'chat',
    payload: { message: content, attachments, audioData }
  })

  // Clean up object URLs after a short delay
  setTimeout(() => {
    objectUrls.forEach(url => URL.revokeObjectURL(url))
  }, 60000) // Revoke after 1 minute
}
```

---

## Moderate Vulnerabilities (MEDIUM - MISSING CLEANUP)

### 2. setTimeout Not Cleaned Up

#### File: `src/components/tasks/TaskCard.tsx:59`

```typescript
setTimeout(() => setShowDeleteConfirm(false), 3000);
```

**VULNERABILITY:** If component unmounts before 3 seconds, the state update will occur on an unmounted component (React warning, potential memory leak).

**Impact:** Minor - React warnings in console, negligible memory impact.

**Fix:**
```typescript
useEffect(() => {
  const timeout = setTimeout(() => setShowDeleteConfirm(false), 3000)
  return () => clearTimeout(timeout)
}, [showDeleteConfirm])
```

---

#### File: `src/components/NotificationProvider.tsx:55`

```typescript
setTimeout(() => {
  removeNotification(id)
}, duration)
```

**VULNERABILITY:** Same issue - no cleanup if component unmounts.

**Fix:**
```typescript
useEffect(() => {
  const timeout = setTimeout(() => {
    removeNotification(id)
  }, duration)
  return () => clearTimeout(timeout)
}, [id, duration, removeNotification])
```

---

### 3. Network Detector - Potential Cleanup Issue

#### File: `src/components/NetworkDetector.tsx:57`

```typescript
useEffect(() => {
  const intervalId = setInterval(checkConnectivity, 30000);
  return () => clearInterval(intervalId);
}, []);
```

**SAFE:** This one correctly cleans up the interval.

However, line 22 has:
```typescript
setTimeout(() => setWasOffline(false), 5000);
```

**VULNERABILITY:** The `setTimeout` is not cleaned up if component unmounts.

**Fix:**
```typescript
useEffect(() => {
  const timeout = setTimeout(() => setWasOffline(false), 5000)
  return () => clearTimeout(timeout)
}, [wasOffline])
```

---

## Positive Findings (SAFE PATTERNS)

### 1. WebSocket Cleanup - EXCELLENT

#### File: `src/contexts/WebSocketContext.tsx:253-259`

```typescript
useEffect(() => {
  connect()

  return () => {
    disconnect()  // ✅ PROPER CLEANUP
  }
}, [])
```

**ASSESSMENT:** The WebSocket context properly cleans up connections on unmount. The `disconnect()` function:

1. Sets `shouldReconnect` to false (prevents reconnection attempts)
2. Closes the WebSocket
3. Clears state

**This is a correct implementation.**

---

#### File: `src/contexts/WebSocketContext.tsx:200-203`

```typescript
setTimeout(() => {
  setReconnectAttempts(prev => prev + 1)
  connect()
}, delay)
```

**POTENTIAL ISSUE:** Reconnection timeouts are NOT tracked and could fire after unmount.

**Recommendation:** Track all reconnection timeouts and clear them on unmount.

---

### 2. useMetrics Hook - PROPER CLEANUP

#### File: `src/hooks/useMetrics.ts:72-80`

```typescript
useEffect(() => {
  if (connected) return

  const interval = setInterval(() => {
    refresh()
  }, 5000)

  return () => clearInterval(interval)  // ✅ PROPER CLEANUP
}, [connected, refresh])
```

**ASSESSMENT:** Correctly clears the interval when:
- Component unmounts
- WebSocket connects (interval no longer needed)
- Dependencies change

---

### 3. useKeyboardNavigation Hook - PROPER CLEANUP

#### File: `src/hooks/useKeyboardNavigation.ts:62-76`

```typescript
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown)
  return () => {
    window.removeEventListener('keydown', handleKeyDown)  // ✅ PROPER CLEANUP
  }
}, [handleKeyDown])
```

**ASSESSMENT:** Event listener properly removed on unmount.

---

## Large Graph Rendering Issues

### Finding: No ForceGraph Implementation Found

**Expected:** Based on audit documentation, the system should have `MemoryGraph` using `react-force-graph-2d` (ForceGraph2D) that renders thousands of nodes.

**Actual:**
- `src/pages/Memory.tsx` contains only a placeholder "Coming soon" message
- No import of `react-force-graph` anywhere in the codebase
- No `ForceGraph` or `ForceGraph2D` components found

**Assessment:** The large graph rendering issue mentioned in the audit documentation **does not exist** in the current codebase. This may be:
1. A planned feature not yet implemented
2. Removed in a previous refactoring
3. Located in a different workspace/repository

**If implemented in the future, these issues should be addressed:**

1. **Web Worker for Graph Layout:** Large graph force-directed layout calculations should run in a Web Worker to avoid blocking the main thread
2. **Virtualization:** For graphs >1000 nodes, use virtualized rendering (only render visible nodes)
3. **LOD (Level of Detail):** Reduce node detail when zoomed out
4. **Progressive Loading:** Load nodes in batches rather than all at once

---

## Performance Recommendations

### 1. Message Array Growth

#### File: `src/pages/AgentChat.tsx:9-16`

```typescript
const [messages, setMessages] = useState<ChatMessageType[]>([
  {
    id: '1',
    role: 'assistant',
    content: 'Hello! I am ZeroClaw...',
    timestamp: Date.now()
  }
])
```

**POTENTIAL ISSUE:** Messages array grows unbounded. In a long session, this could contain thousands of messages.

**Recommendation:** Implement pagination or virtual scrolling for large chat histories.

---

### 2. Memoization Opportunities

Several components could benefit from `React.memo`:

1. **`ChatMessage`** component - Re-renders on every message change
2. **`MetricCard`** - Could be memoized since props change infrequently
3. **`TaskCard`** - Re-renders when any task changes

**Example:**
```typescript
export const ChatMessage = React.memo(({ message }: ChatMessageProps) => {
  // ... component
}, (prevProps, nextProps) => {
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.content === nextProps.message.content &&
         prevProps.message.streaming === nextProps.message.streaming
})
```

---

### 3. Unnecessary Re-renders from WebSocket Context

#### File: `src/contexts/WebSocketContext.tsx:84`

```typescript
const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
```

**ISSUE:** Every WebSocket message triggers context update, causing all consumers to re-render.

**Recommendation:** Use separate state for different message types or use `useSelector` pattern:

```typescript
// Instead of single lastMessage
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
const [metrics, setMetrics] = useState<MetricsData | null>(null)
const [handStatus, setHandStatus] = useState<HandStatus | null>(null)

// In useEffect, route messages appropriately
useEffect(() => {
  if (!lastMessage) return

  switch (lastMessage.type) {
    case 'chat_stream':
      setChatMessages(prev => [...prev, lastMessage.payload])
      break
    case 'metrics':
      setMetrics(lastMessage.payload)
      break
    case 'hand_status':
      setHandStatus(lastMessage.payload)
      break
  }
}, [lastMessage])
```

---

## State Management Issues

### Zustand Stores - Generally Well Implemented

#### File: `src/stores/metricsStore.ts`

The store uses Zustand with proper pattern:
- Atomic updates
- No unnecessary re-renders
- Selector-based subscriptions

**ASSESSMENT:** No issues found.

---

## Summary Statistics

| Category | Safe | Vulnerable | Total |
|----------|------|------------|-------|
| WebSocket cleanup | 1 | 1 minor | 2 |
| setTimeout/setInterval | 3 | 3 | 6 |
| Event listeners | 2 | 0 | 2 |
| Object URL management | 0 | 1 CRITICAL | 1 |
| Large rendering | N/A | N/A | Not implemented |

---

## Recommended Fix Priority

### Priority 1 (CRITICAL - Memory Leak)
1. **`src/pages/AgentChat.tsx`** - Revoke object URLs for file attachments

### Priority 2 (Medium - Cleanup)
2. **`src/components/tasks/TaskCard.tsx`** - Clean up setTimeout
3. **`src/components/NotificationProvider.tsx`** - Clean up setTimeout
4. **`src/components/NetworkDetector.tsx`** - Clean up setTimeout

### Priority 3 (Improvement - Performance)
5. Implement chat message pagination/virtualization
6. Add `React.memo` to frequently re-rendering components
7. Optimize WebSocket context to reduce unnecessary re-renders

---

## Testing Recommendations

1. **Memory Profiling:** Use Chrome DevTools Memory profiler to track heap usage during:
   - Long chat sessions with file attachments
   - Dashboard open for extended periods
   - Frequent navigation between pages

2. **Leak Detection:** Use React's Strict Mode and `why-did-you-render` to detect unnecessary re-renders

3. **Load Testing:** Simulate heavy WebSocket message traffic to ensure no backpressure issues

---

## Conclusion

The ZeroClaw React frontend demonstrates **mostly safe patterns** for resource management, with one critical memory leak requiring immediate attention (Object URLs). The WebSocket implementation is well-designed with proper cleanup, and most useEffect hooks correctly clean up their resources.

**Key Positive:**
- WebSocket cleanup is properly implemented
- Most useEffect hooks have cleanup functions
- No large graph rendering issues (not implemented)

**Key Issues:**
- CRITICAL: Object URL memory leak in file attachments
- Several setTimeout calls without cleanup
- Unbounded message array growth

**Estimated Fix Effort:**
- Priority 1: 1-2 hours
- Priority 2: 2-3 hours
- Priority 3: 1-2 days
