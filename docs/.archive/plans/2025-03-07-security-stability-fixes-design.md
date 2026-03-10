# ZeroClaw Security & Stability Fixes - Design Document

**Date:** 2025-03-07
**Status:** Approved
**Author:** Claude (User: commander)
**Reviewer:** External Architect

---

## Executive Summary

This document describes the design for critical security and stability fixes identified by external architecture review. The fixes address zombie processes, sandbox isolation, CPU-aware memory hygiene, firewall configuration, and frontend state persistence.

**Impact:** All 5 issues must be resolved before production deployment.

---

## Problem Statement

An external architect identified 5 critical issues:

1. **Zombie Processes** - Shell commands spawn child processes that survive cancellation
2. **Sandbox Bypass** - Concurrent hands share working directory, causing file conflicts
3. **CPU-Unaware Hygiene** - Memory cleanup runs on fixed timer, ignoring system load
4. **Missing Firewall** - No UFW configuration, daemon exposed unprotected
5. **State Loss on Refresh** - Frontend state (Kanban, chat) disappears on page reload

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Implementation order | Unified update | Fixes are interrelated |
| Process group killing | Raw libc calls | No new dependency, lighter weight |
| Isolation layer | HandsDispatcher | Centralized hand management |
| CPU threshold | Configurable (default 90%) | Flexible per deployment |
| State persistence | Hybrid (ls + IDB) | Balance simplicity and capacity |

---

## Section 1: Zombie Process Fix

### Current Issue
`src/tools/shell.rs` uses `tokio::process::Command` without process group handling. When cancelled, shell dies but child processes (npm, node, etc.) continue as orphans.

### Solution

**1.1 Extend `NativeRuntime` with process groups**

```rust
// src/runtime/native.rs
use std::os::unix::process::CommandExt;

impl RuntimeAdapter for NativeRuntime {
    fn build_shell_command_with_group(
        &self,
        command: &str,
        workspace_dir: &Path,
        hand_id: Option<&str>,
    ) -> anyhow::Result<(tokio::process::Command, Option<u32>)> {
        let mut cmd = std::process::Command::new("sh");
        cmd.arg("-c").arg(command).current_dir(workspace_dir);

        // Create new process group for isolation
        unsafe {
            cmd.pre_exec(|| {
                libc::setsid();
                Ok(())
            });
        }

        let pgid = cmd.spawn()?.id();
        Ok((tokio::process::Command::from(cmd), Some(pgid)))
    }
}
```

**1.2 Track PGID in HandsDispatcher**

```rust
// src/agent/hands.rs
pub struct HandState {
    pub token: CancellationToken,
    pub pgid: Option<u32>,
    pub workspace: Option<HandWorkspace>,
}

pub struct HandsDispatcher {
    pub hands_semaphore: Arc<Semaphore>,
    pub active_hands: Arc<RwLock<HashMap<String, HandState>>>,
}
```

**1.3 Kill process groups in InterruptionHandler**

```rust
// src/agent/interruption.rs
use libc::{kill, SIGKILL};

impl InterruptionHandler {
    pub async fn interrupt_with_pgid(&self, hand_id: &str, pgid: Option<u32>) -> Result<()> {
        if let Some(pgid) = pgid {
            unsafe { kill(-(pgid as i32), SIGKILL) };
        }
        self.interrupt(hand_id).await
    }
}
```

**1.4 Add kill_on_drop to ShellTool**

```rust
// src/tools/shell.rs
let mut cmd = runtime.build_shell_command_with_group(command, &workspace, hand_id)?;
cmd.kill_on_drop(true);
```

### Files Modified
- `src/runtime/native.rs`
- `src/runtime/traits.rs`
- `src/agent/hands.rs`
- `src/agent/interruption.rs`
- `src/tools/shell.rs`

---

## Section 2: Sandbox Isolation

### Current Issue
All hands execute in same `workspace_dir`. Concurrent operations overwrite files.

### Solution

**2.1 Create HandWorkspace module**

```rust
// src/agent/workspace.rs
pub struct HandWorkspace {
    pub path: PathBuf,
    hand_id: String,
}

impl HandWorkspace {
    pub fn create(base_dir: &Path, hand_id: &str) -> Result<Self> {
        let workspace = base_dir.join(format!("hands/{}", hand_id));
        fs::create_dir_all(&workspace)?;
        Ok(Self { path: workspace, hand_id: hand_id.to_string() })
    }

    pub fn cleanup(self) -> Result<()> {
        fs::remove_dir_all(self.path)
    }
}
```

**2.2 Integrate into HandsDispatcher**

```rust
impl HandsDispatcher {
    pub async fn register_hand(&self, hand_id: String) -> Result<HandWorkspace> {
        let token = CancellationToken::new();
        let workspace = HandWorkspace::create(&self.base_dir, &hand_id)?;

        let state = HandState {
            token,
            pgid: None,
            workspace: Some(workspace),
        };

        let mut hands = self.active_hands.write().await;
        hands.insert(hand_id.clone(), state);
        Ok(workspace)
    }

    pub async fn unregister_hand(&self, hand_id: &str) {
        let mut hands = self.active_hands.write().await;
        if let Some(state) = hands.remove(hand_id) {
            if let Some(ws) = state.workspace {
                ws.cleanup().ok();
            }
        }
    }
}
```

**2.3 Use workspace in ShellTool**

```rust
// src/tools/shell.rs
// Use hand workspace if available, else security.workspace_dir
let work_dir = hand_workspace.as_ref().unwrap_or(&security.workspace_dir);
```

### Files Modified
- `src/agent/hands.rs`
- `src/tools/shell.rs`
- NEW: `src/agent/workspace.rs`

---

## Section 3: CPU Idle Detection

### Current Issue
`hygiene.rs` runs on fixed 12-hour timer regardless of system load.

### Solution

**3.1 Add sysinfo dependency**

```toml
# Cargo.toml
[dependencies]
sysinfo = "0.32"
```

**3.2 Add config fields**

```rust
// src/config.rs
#[derive(Clone, Deserialize, Serialize)]
pub struct HygieneConfig {
    pub enabled: bool,
    pub cpu_idle_threshold_percent: u8,  // default: 90
    pub max_wait_hours: u64,              // default: 24
}
```

**3.3 Create CpuMonitor**

```rust
// src/monitoring/cpu.rs
pub struct CpuMonitor {
    threshold: u8,
    system: sysinfo::System,
}

impl CpuMonitor {
    pub fn new(threshold: u8) -> Self {
        let mut system = sysinfo::System::new();
        system.refresh_cpu();
        Self { threshold, system }
    }

    pub fn is_idle_enough(&self) -> bool {
        self.system.refresh_cpu();
        let usage = self.system.global_cpu_usage();
        usage < (100 - self.threshold) as f32
    }

    pub async fn wait_until_idle(&self, max_duration: Duration) -> bool {
        let start = Instant::now();
        while start.elapsed() < max_duration {
            if self.is_idle_enough() {
                return true;
            }
            tokio::time::sleep(Duration::from_secs(300)).await;  // Check every 5 min
        }
        false
    }
}
```

**3.4 Update hygiene run**

```rust
// src/memory/hygiene.rs
pub async fn run_if_due_smart(config: &HygieneConfig, workspace: &Path) -> Result<()> {
    if !should_run_now(workspace)? {
        return Ok(());
    }

    let monitor = CpuMonitor::new(config.cpu_idle_threshold_percent);

    if !monitor.is_idle_enough() {
        tracing::info!("CPU busy, waiting for idle window...");
        if !monitor.wait_until_idle(Duration::from_secs(config.max_wait_hours * 3600)).await {
            tracing::warn!("CPU never reached idle threshold, skipping hygiene");
            return Ok(());
        }
    }

    run_hygiene_tasks(config, workspace)?;
    Ok(())
}
```

### Files Modified
- `Cargo.toml`
- `src/config.rs`
- NEW: `src/monitoring/cpu.rs`
- NEW: `src/monitoring/mod.rs`
- `src/memory/hygiene.rs`

---

## Section 4: UFW Firewall Script

### Current Issue
No firewall configuration. Daemon exposed to all networks.

### Solution

**4.1 Create configure_ufw.sh**

```bash
#!/bin/bash
# ZeroClaw Firewall Configuration
# Usage: sudo ./scripts/configure_ufw.sh

set -e

echo "=== ZeroClaw Firewall Configuration ==="

# Reset to safe defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (adjust if using different port)
ufw allow 22/tcp comment 'SSH access'

# ZeroClaw API with rate limiting
ufw limit 42617/tcp comment 'ZeroClaw API (rate limited)'

# Allow localhost for development
ufw allow from 127.0.0.1 to any port 42617 comment 'Local development'

# Enable logging
ufw logging medium

# Enable firewall
ufw --force enable

echo ""
echo "=== UFW Status ==="
ufw status numbered
echo ""
echo "✅ Firewall configured for ZeroClaw"
```

**4.2 Integrate into bootstrap**

```bash
# scripts/bootstrap.sh
# Add firewall setup
if [[ "$SKIP_FIREWALL" != "1" ]]; then
    ./scripts/configure_ufw.sh || echo "⚠️  Firewall setup failed, run manually later"
fi
```

### Files Created
- NEW: `scripts/configure_ufw.sh`
- MODIFY: `scripts/bootstrap.sh`
- NEW: `docs/security.md` (documentation)

---

## Section 5: Frontend State Persistence

### Current Issue
UI state lost on page refresh. No initial state fetch from server.

### Solution

**5.1 Create storage utilities**

```typescript
// web/src/lib/storage/local.ts
export const localStore = {
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: string): void {
    localStorage.removeItem(key);
  }
};
```

```typescript
// web/src/lib/storage/indexed.ts
import { openDB } from 'idb';

const DB_NAME = 'zeroclaw';
const STORE = 'messages';

export const idbStore = {
  async getMessages(handId: string): Promise<A2AMessage[]> {
    const db = await openDB(DB_NAME, 1);
    return db.getAll(STORE);
  },

  async addMessage(msg: A2AMessage): Promise<void> {
    const db = await openDB(DB_NAME, 1);
    await db.put(STORE, msg);
  },

  async clearHand(handId: string): Promise<void> {
    const db = await openDB(DB_NAME, 1);
    await db.delete(STORE, IDBKeyRange.bound(
      [handId, ''],
      [handId, '\uffff']
    ));
  }
};
```

**5.2 Add initial state fetch hook**

```typescript
// web/src/hooks/useInitialHandState.ts
export function useInitialHandState() {
  const { setHands, hydrate } = useStore();
  const { apiFetch } = useApi();

  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        const status = await apiFetch<AgentStatus>('/v1/agent/status');
        setHands(status.active_hands);

        // Hydrate from localStorage
        const saved = localStore.get<UiState>('zeroclaw_ui');
        if (saved) hydrate(saved);
      } catch (e) {
        console.error('Failed to fetch initial state:', e);
      }
    };

    fetchInitialState();
  }, []);
}
```

**5.3 Update Zustand store**

```typescript
// web/src/lib/store.ts
interface UiStore {
  hands: Hand[];
  tasks: Task[];

  hydrate: (state: Partial<UiStore>) => void;
  persist: () => void;
}

export const useStore = create<UiStore>((set, get) => ({
  hands: [],
  tasks: [],

  hydrate: (state) => set(state),

  persist: () => {
    const { tasks, hands } = get();
    localStore.set('zeroclaw_ui', { tasks, hands });
  },
}));

// Auto-persist on changes
useStore.subscribe(
  (state) => ({ tasks: state.tasks, hands: state.hands }),
  (state) => localStore.set('zeroclaw_ui', state),
  { equalityFn: shallow }
);
```

**5.4 WebSocket reconnection**

```typescript
// web/src/hooks/useA2AStream.ts
useEffect(() => {
  const handleReconnect = async () => {
    // Fetch fresh state from server
    const status = await apiFetch<AgentStatus>('/v1/agent/status');
    setHands(status.active_hands);
  };

  ws.addEventListener('open', handleReconnect);
  return () => ws.removeEventListener('open', handleReconnect);
}, []);
```

### Dependencies Required

```json
// web/package.json
{
  "dependencies": {
    "idb": "^8.0.0"  // IndexedDB wrapper
  }
}
```

### Files Created/Modified
- NEW: `web/src/lib/storage/local.ts`
- NEW: `web/src/lib/storage/indexed.ts`
- NEW: `web/src/hooks/useInitialHandState.ts`
- MODIFY: `web/src/lib/store.ts`
- MODIFY: `web/src/hooks/useA2AStream.ts`
- MODIFY: `web/package.json`

---

## Testing Strategy

### Backend Tests

1. **Zombie Process Test**
   - Spawn shell with child process
   - Cancel hand
   - Verify child process is killed (check PGID)

2. **Sandbox Isolation Test**
   - Register two hands
   - Create file in each workspace
   - Verify isolation (files in separate dirs)

3. **CPU Monitor Test**
   - Mock CPU usage
   - Verify `is_idle_enough()` returns correct value
   - Test timeout behavior

### Frontend Tests

1. **Persistence Test**
   - Set state
   - Simulate page reload
   - Verify state restored

2. **IndexedDB Test**
   - Add messages
   - Retrieve by hand_id
   - Clear and verify

### Integration Tests

1. **Full Cycle**
   - Register hand
   - Execute command
   - Cancel hand
   - Verify cleanup (workspace removed, processes killed)

---

## Rollout Plan

1. **Phase 1: Backend Core** (Sections 1-3)
   - Implement zombie process fix
   - Add sandbox isolation
   - Add CPU monitoring
   - Test with existing integration tests

2. **Phase 2: Infrastructure** (Section 4)
   - Add UFW script
   - Update bootstrap
   - Document manual setup

3. **Phase 3: Frontend** (Section 5)
   - Add storage utilities
   - Update Zustand store
   - Test persistence

4. **Phase 4: Verification**
   - Full integration test
   - Load testing
   - Security review

---

## Success Criteria

- [ ] Shell command children killed on hand cancellation
- [ ] Concurrent hands use isolated workspaces
- [ ] Memory hygiene only runs when CPU idle (configurable)
- [ ] UFW configured with rate limiting on port 42617
- [ ] Frontend state persists across page refreshes
- [ ] All existing tests pass
- [ ] New tests added for all fixes

---

**End of Design Document**
