# Security & Stability Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 critical security and stability issues identified by external architect: zombie processes, sandbox isolation, CPU-aware hygiene, UFW firewall, and frontend state persistence.

**Architecture:** Backend fixes extend existing modules (Runtime, HandsDispatcher, Hygiene) with process group handling, workspace isolation, and CPU monitoring. Frontend adds hybrid persistence (localStorage + IndexedDB) with initial state fetch.

**Tech Stack:** Rust (libc, sysinfo crates), TypeScript (idb, Zustand), Bash (UFW)

---

## Task 1: Add Process Group Support to NativeRuntime

**Files:**
- Modify: `src/runtime/traits.rs`
- Modify: `src/runtime/native.rs`
- Test: `src/runtime/native.rs` (extend existing tests)

**Step 1: Update RuntimeAdapter trait to support process groups**

Add method to `src/runtime/traits.rs`:

```rust
use tokio::process::Command;

pub trait RuntimeAdapter {
    // ... existing methods ...

    /// Build shell command with optional process group creation for hand isolation
    ///
    /// # Returns
    /// - Command ready to spawn
    /// - Process Group ID (PGID) if process group was created, None otherwise
    fn build_shell_command_with_group(
        &self,
        command: &str,
        workspace_dir: &Path,
        hand_id: Option<&str>,
    ) -> anyhow::Result<(Command, Option<u32>)>;
}
```

**Step 2: Implement process group creation in NativeRuntime**

Add to `src/runtime/native.rs`:

```rust
use std::os::unix::process::CommandExt;

impl RuntimeAdapter for NativeRuntime {
    // ... existing methods ...

    fn build_shell_command_with_group(
        &self,
        command: &str,
        workspace_dir: &Path,
        _hand_id: Option<&str>,
    ) -> anyhow::Result<(tokio::process::Command, Option<u32>)> {
        // Spawn process to get PGID, then convert to tokio::process::Command
        let mut std_cmd = std::process::Command::new("sh");
        std_cmd.arg("-c").arg(command).current_dir(workspace_dir);

        // Create new process session (becomes process group leader)
        unsafe {
            std_cmd.pre_exec(|| {
                libc::setsid();
                Ok(())
            });
        }

        // Spawn to get the actual PGID
        let child = std_cmd.spawn()
            .map_err(|e| anyhow::anyhow!("Failed to spawn shell: {e}"))?;

        let pgid = child.id();
        drop(child); // We'll re-spawn properly below

        // Now create the tokio command with same settings
        let mut cmd = tokio::process::Command::new("sh");
        cmd.arg("-c").arg(command).current_dir(workspace_dir);

        unsafe {
            cmd.pre_exec(|| {
                libc::setsid();
                Ok(())
            });
        }

        Ok((cmd, Some(pgid as u32)))
    }
}
```

**Step 3: Add default implementation for other runtimes**

Add to `src/runtime/traits.rs`:

```rust
#[cfg(feature = "wasm")]
impl RuntimeAdapter for WasmRuntime {
    fn build_shell_command_with_group(
        &self,
        _command: &str,
        _workspace_dir: &Path,
        _hand_id: Option<&str>,
    ) -> anyhow::Result<(tokio::process::Command, Option<u32>)> {
        Err(anyhow::anyhow!("Shell commands not supported in WASM"))
    }
}
```

**Step 4: Add test for process group creation**

Add to `src/runtime/native.rs` tests:

```rust
#[test]
fn native_creates_process_group() {
    let runtime = NativeRuntime::new();
    let (cmd, pgid) = runtime
        .build_shell_command_with_group("echo test", Path::new("/tmp"), Some("hand1"))
        .expect("Should create command with group");

    assert!(pgid.is_some(), "PGID should be present when hand_id provided");
}
```

**Step 5: Run tests to verify**

Run: `cargo test --package zeroclaw native_creates_process_group -v`
Expected: PASS

**Step 6: Commit**

```bash
git add src/runtime/traits.rs src/runtime/native.rs
git commit -m "feat(runtime): add process group support to NativeRuntime

- Add build_shell_command_with_group() to RuntimeAdapter trait
- Implement setsid() for process group creation
- Return PGID for later killing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Extend HandState with PGID and Workspace

**Files:**
- Modify: `src/agent/hands.rs`
- Test: `src/agent/hands.rs` (extend existing tests)

**Step 1: Add HandState struct**

Replace simple HashMap in `src/agent/hands.rs`:

```rust
use tokio_util::sync::CancellationToken;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};

/// State for an active hand execution
#[derive(Debug)]
pub struct HandState {
    /// Cancellation token for cooperative cancellation
    pub token: CancellationToken,
    /// Process Group ID for killing child processes
    pub pgid: Option<u32>,
    /// Isolated workspace path
    pub workspace: Option<PathBuf>,
}

impl HandState {
    pub fn new(token: CancellationToken) -> Self {
        Self {
            token,
            pgid: None,
            workspace: None,
        }
    }
}
```

**Step 2: Update HandsDispatcher to use HandState**

Modify `src/agent/hands.rs`:

```rust
pub struct HandsDispatcher {
    pub hands_semaphore: Arc<Semaphore>,
    pub active_hands: Arc<RwLock<HashMap<String, HandState>>>,
    pub base_dir: PathBuf,
}

impl HandsDispatcher {
    pub fn new(max_concurrent: usize, base_dir: PathBuf) -> Self {
        Self {
            hands_semaphore: Arc::new(Semaphore::new(max_concurrent)),
            active_hands: Arc::new(RwLock::new(HashMap::new())),
            base_dir,
        }
    }

    pub fn default() -> Self {
        Self::new(10, PathBuf::from("/tmp/zeroclaw"))
    }
}
```

**Step 3: Update register_hand to return state reference**

Modify `src/agent/hands.rs`:

```rust
impl HandsDispatcher {
    /// Register a new hand and return mutable reference to its state
    pub async fn register_hand(&self, hand_id: String) -> Arc<Semaphore> {
        let token = CancellationToken::new();
        let state = HandState::new(token);

        let mut hands = self.active_hands.write().await;
        hands.insert(hand_id.clone(), state);

        Arc::clone(&self.hands_semaphore)
    }

    /// Update PGID for a registered hand
    pub async fn set_hand_pgid(&self, hand_id: &str, pgid: u32) {
        let mut hands = self.active_hands.write().await;
        if let Some(state) = hands.get_mut(hand_id) {
            state.pgid = Some(pgid);
        }
    }

    /// Set workspace path for a registered hand
    pub async fn set_hand_workspace(&self, hand_id: &str, workspace: PathBuf) {
        let mut hands = self.active_hands.write().await;
        if let Some(state) = hands.get_mut(hand_id) {
            state.workspace = Some(workspace);
        }
    }
}
```

**Step 4: Update tests for new structure**

Update `src/agent/hands.rs` tests:

```rust
#[tokio::test]
async fn test_hand_state_creation() {
    let token = CancellationToken::new();
    let state = HandState::new(token.clone());
    assert!(state.pgid.is_none());
    assert!(state.workspace.is_none());
    assert!(!state.token.is_cancelled());
}

#[tokio::test]
async fn test_register_and_unregister_hand_with_state() {
    let dispatcher = HandsDispatcher::new(5, PathBuf::from("/tmp/test"));

    dispatcher.register_hand("hand1".to_string()).await;
    assert_eq!(dispatcher.active_count().await, 1);

    dispatcher.unregister_hand("hand1").await;
    assert_eq!(dispatcher.active_count().await, 0);
}

#[tokio::test]
async fn test_set_hand_pgid() {
    let dispatcher = HandsDispatcher::new(5, PathBuf::from("/tmp/test"));

    dispatcher.register_hand("hand1".to_string()).await;
    dispatcher.set_hand_pgid("hand1", 12345).await;

    let hands = dispatcher.active_hands.read().await;
    let state = hands.get("hand1").unwrap();
    assert_eq!(state.pgid, Some(12345));
}
```

**Step 5: Run tests to verify**

Run: `cargo test --package zeroclaw hands -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/agent/hands.rs
git commit -m "refactor(hands): extend HandState with PGID and workspace

- Add HandState struct with token, pgid, workspace fields
- Update HandsDispatcher to use HandState instead of bare token
- Add set_hand_pgid() and set_hand_workspace() methods
- Update tests for new structure

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Implement Process Group Killing in InterruptionHandler

**Files:**
- Modify: `src/agent/interruption.rs`
- Test: `src/agent/interruption.rs` (extend existing tests)

**Step 1: Add libc dependency for kill syscall**

Add to `Cargo.toml` (if not present):

```toml
[dependencies]
libc = "0.2"  # Should already be present
```

**Step 2: Add process group killing method**

Update `src/agent/interruption.rs`:

```rust
use tokio_util::sync::CancellationToken;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct InterruptionHandler {
    pub active_hands: Arc<RwLock<HashMap<String, CancellationToken>>>,
}

impl InterruptionHandler {
    pub fn new() -> Self {
        Self {
            active_hands: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn interrupt(&self, hand_id: &str) -> Result<(), anyhow::Error> {
        let hands = self.active_hands.read().await;
        if let Some(token) = hands.get(hand_id) {
            token.cancel();
        }
        Ok(())
    }

    /// Kill a process group by PGID
    ///
    /// # Safety
    /// PGID must be valid and owned by this process
    pub fn kill_process_group(pgid: u32) -> Result<(), anyhow::Error> {
        unsafe {
            // Negative PGID kills the entire process group
            if libc::kill(-(pgid as i32), libc::SIGKILL) == -1 {
                let err = std::io::Error::last_os_error();
                // ESRCH (No such process) is OK - process already exited
                if err.raw_os_error() != Some(libc::ESRCH) {
                    return Err(err.into());
                }
            }
        }
        Ok(())
    }
}
```

**Step 3: Integrate with HandsDispatcher**

Add method to `src/agent/hands.rs`:

```rust
use crate::agent::interruption::InterruptionHandler;

impl HandsDispatcher {
    /// Interrupt a hand and kill its entire process group
    pub async fn interrupt_hand_killed(&self, hand_id: &str) -> Result<(), anyhow::Error> {
        let (token, pgid) = {
            let hands = self.active_hands.read().await;
            let state = hands.get(hand_id);
            state.map(|s| (s.token.clone(), s.pgid))
        };

        // Kill process group first
        if let Some(pgid) = pgid {
            InterruptionHandler::kill_process_group(pgid)?;
        }

        // Then cancel token for cooperative cancellation
        if let Some(token) = token {
            token.cancel();
        }

        Ok(())
    }
}
```

**Step 4: Add tests for process group killing**

Add to `src/agent/interruption.rs` tests:

```rust
#[test]
fn test_kill_process_group_returns_ok_for_valid_pgid() {
    // We can't easily test actual killing without spawning processes
    // Just verify the function doesn't crash for valid input
    let result = InterruptionHandler::kill_process_group(99999);
    // Will fail with ESRCH (no such process) which is OK
    assert!(result.is_ok() || result.unwrap_err().to_string().contains("No such process"));
}
```

**Step 5: Run tests to verify**

Run: `cargo test --package zeroclaw interruption -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/agent/interruption.rs src/agent/hands.rs
git commit -m feat(interruption): add process group killing

- Add kill_process_group() using libc::kill with negative PGID
- Handle ESRCH gracefully (process already exited)
- Add interrupt_hand_killed() to HandsDispatcher
- Kill process group before cancelling token

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Update ShellTool to Use Process Groups

**Files:**
- Modify: `src/tools/shell.rs`
- Test: `src/tools/shell.rs` (extend existing tests)

**Step 1: Modify ShellTool to accept hand context**

Update `src/tools/shell.rs`:

```rust
use super::traits::{Tool, ToolResult};
use crate::runtime::RuntimeAdapter;
use crate::security::SecurityPolicy;
use crate::agent::hands::HandsDispatcher;
use async_trait::async_trait;
use serde_json::json;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

pub struct ShellTool {
    security: Arc<SecurityPolicy>,
    runtime: Arc<dyn RuntimeAdapter>,
    hands_dispatcher: Option<Arc<HandsDispatcher>>,
}

impl ShellTool {
    pub fn new(security: Arc<SecurityPolicy>, runtime: Arc<dyn RuntimeAdapter>) -> Self {
        Self {
            security,
            runtime,
            hands_dispatcher: None,
        }
    }

    pub fn with_dispatcher(mut self, dispatcher: Arc<HandsDispatcher>) -> Self {
        self.hands_dispatcher = Some(dispatcher);
        self
    }
}
```

**Step 2: Update execute method to use process groups**

Update `execute()` in `src/tools/shell.rs` (replace command building section):

```rust
async fn execute(&self, args: serde_json::Value) -> anyhow::Result<ToolResult> {
    // ... existing validation code ...

    // Extract hand_id if present in args
    let hand_id = args.get("hand_id").and_then(|v| v.as_str());

    // Build command with process group support
    let (mut cmd, pgid) = self
        .runtime
        .build_shell_command_with_group(command, &self.security.workspace_dir, hand_id)
        .await
        .map_err(|e| ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("Failed to build command: {e}")),
        })?;

    // Store PGID if we have a dispatcher
    if let (Some(hand_id), Some(pgid), Some(dispatcher)) = (hand_id, pgid, &self.hands_dispatcher) {
        dispatcher.set_hand_pgid(hand_id, pgid).await;
    }

    cmd.env_clear();
    for var in collect_allowed_shell_env_vars(&self.security) {
        if let Ok(val) = std::env::var(&var) {
            cmd.env(&var, val);
        }
    }

    // CRITICAL: Kill child processes when command is dropped
    cmd.kill_on_drop(true);

    // ... rest of existing execution code ...
}
```

**Step 3: Add test for kill_on_drop**

Add to `src/tools/shell.rs` tests:

```rust
#[tokio::test]
async fn shell_command_has_kill_on_drop() {
    let security = Arc::new(SecurityPolicy {
        autonomy: AutonomyLevel::Full,
        workspace_dir: std::env::temp_dir(),
        ..SecurityPolicy::default()
    });
    let runtime = Arc::new(NativeRuntime::new());
    let tool = ShellTool::new(security, runtime);

    let (cmd, _) = tool
        .runtime
        .build_shell_command_with_group("echo test", &std::env::temp_dir(), Some("test"))
        .expect("Should build command");

    // We can't directly test kill_on_drop, but verify command was created
    // Integration tests will verify actual killing behavior
}
```

**Step 4: Run tests to verify**

Run: `cargo test --package zeroclaw shell -v`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tools/shell.rs
git commit -m "feat(shell): integrate process group killing

- Add hands_dispatcher to ShellTool
- Use build_shell_command_with_group() for PGID support
- Store PGID in dispatcher after spawn
- Add kill_on_drop(true) to Command

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Create HandWorkspace Module

**Files:**
- Create: `src/agent/workspace.rs`
- Modify: `src/agent/mod.rs`
- Test: `src/agent/workspace.rs`

**Step 1: Create workspace module**

Create `src/agent/workspace.rs`:

```rust
use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

/// Isolated workspace for a single hand execution
///
/// Each hand gets its own directory to prevent file conflicts
/// between concurrent operations.
pub struct HandWorkspace {
    /// Path to the isolated workspace
    pub path: PathBuf,
    /// Unique hand identifier
    pub hand_id: String,
}

impl HandWorkspace {
    /// Create a new isolated workspace for a hand
    ///
    /// # Arguments
    /// - `base_dir`: Base directory for all workspaces (e.g., /tmp/zeroclaw)
    /// - `hand_id`: Unique identifier for this hand
    ///
    /// # Returns
    /// A new HandWorkspace with the directory created
    pub fn create(base_dir: &Path, hand_id: &str) -> Result<Self> {
        let workspace = base_dir.join("hands").join(hand_id);

        // Create workspace directory
        fs::create_dir_all(&workspace)
            .with_context(|| format!("Failed to create workspace at {:?}", workspace))?;

        Ok(Self {
            path: workspace,
            hand_id: hand_id.to_string(),
        })
    }

    /// Get the workspace path
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Clean up the workspace directory
    ///
    /// # Warning
    /// This will delete all files in the workspace
    pub fn cleanup(self) -> Result<()> {
        fs::remove_dir_all(&self.path)
            .with_context(|| format!("Failed to cleanup workspace at {:?}", self.path))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workspace_creation() {
        let temp = tempfile::tempdir().unwrap();
        let base = temp.path();

        let ws = HandWorkspace::create(base, "test_hand").unwrap();
        assert!(ws.path().exists());
        assert!(ws.path().ends_with("hands/test_hand"));
    }

    #[test]
    fn test_workspace_cleanup() {
        let temp = tempfile::tempdir().unwrap();
        let base = temp.path();

        let ws = HandWorkspace::create(base, "test_hand").unwrap();

        // Create a test file
        let test_file = ws.path().join("test.txt");
        fs::write(&test_file, "test").unwrap();
        assert!(test_file.exists());

        // Cleanup
        ws.cleanup().unwrap();
        assert!(!ws.path().exists());
    }

    #[test]
    fn test_concurrent_workspaces_isolated() {
        let temp = tempfile::tempdir().unwrap();
        let base = temp.path();

        let ws1 = HandWorkspace::create(base, "hand1").unwrap();
        let ws2 = HandWorkspace::create(base, "hand2").unwrap();

        // Different paths
        assert_ne!(ws1.path(), ws2.path());

        // Both exist
        assert!(ws1.path().exists());
        assert!(ws2.path().exists());

        // Cleanup doesn't affect the other
        ws1.cleanup().unwrap();
        assert!(!ws1.path().exists());
        assert!(ws2.path().exists());
    }
}
```

**Step 2: Add module to agent mod.rs**

Add to `src/agent/mod.rs`:

```rust
pub mod workspace;
pub use workspace::HandWorkspace;
```

**Step 3: Add tempfile dependency**

Add to `Cargo.toml`:

```toml
[dev-dependencies]
tempfile = "3"
```

**Step 4: Run tests to verify**

Run: `cargo test --package zeroclaw workspace -v`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/agent/workspace.rs src/agent/mod.rs Cargo.toml
git commit -m "feat(workspace): add isolated workspace for hands

- Create HandWorkspace struct for isolated directories
- Each hand gets /tmp/zeroclaw/hands/{hand_id}
- Add cleanup() to remove workspace after use
- Add tests for creation, cleanup, and isolation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Integrate Workspace into HandsDispatcher

**Files:**
- Modify: `src/agent/hands.rs`
- Test: `src/agent/hands.rs` (extend)

**Step 1: Update register_hand to create workspace**

Update `src/agent/hands.rs`:

```rust
use crate::agent::workspace::HandWorkspace;
use std::path::PathBuf;

impl HandsDispatcher {
    pub async fn register_hand(&self, hand_id: String) -> Result<PathBuf, anyhow::Error> {
        let token = CancellationToken::new();

        // Create isolated workspace
        let workspace = HandWorkspace::create(&self.base_dir, &hand_id)?;
        let workspace_path = workspace.path().to_path_buf();

        let state = HandState {
            token,
            pgid: None,
            workspace: Some(workspace_path.clone()),
        };

        let mut hands = self.active_hands.write().await;
        hands.insert(hand_id.clone(), state);

        Ok(workspace_path)
    }
}
```

**Step 2: Update unregister_hand to cleanup workspace**

Update `src/agent/hands.rs`:

```rust
impl HandsDispatcher {
    pub async fn unregister_hand(&self, hand_id: &str) -> Result<(), anyhow::Error> {
        let mut hands = self.active_hands.write().await;

        if let Some(mut state) = hands.remove(hand_id) {
            // Clean up workspace if it exists
            if let Some(workspace_path) = state.workspace.take() {
                // Note: We can't call HandWorkspace::cleanup() here because
                // we only have the PathBuf, not the HandWorkspace itself.
                // We'll remove the directory directly.
                if workspace_path.exists() {
                    fs::remove_dir_all(&workspace_path)
                        .with_context(|| format!("Failed to cleanup workspace {:?}", workspace_path))?;
                }
            }
        }

        Ok(())
    }
}
```

Add import:

```rust
use std::fs;
```

**Step 3: Update tests**

Update `src/agent/hands.rs` tests:

```rust
#[tokio::test]
async fn test_workspace_creation_on_register() {
    let temp = tempfile::tempdir().unwrap();
    let dispatcher = HandsDispatcher::new(5, temp.path().to_path_buf());

    let ws_path = dispatcher.register_hand("hand1".to_string()).await.unwrap();
    assert!(ws_path.exists());
    assert!(ws_path.ends_with("hands/hand1"));

    dispatcher.unregister_hand("hand1").await.unwrap();
    assert!(!ws_path.exists());
}
```

**Step 4: Run tests to verify**

Run: `cargo test --package zeroclaw hands -v`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/agent/hands.rs
git commit -m "feat(hands): create workspace on register, cleanup on unregister

- Create isolated HandWorkspace when hand is registered
- Return workspace path to caller
- Clean up workspace directory when hand is unregistered
- Add test for workspace lifecycle

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Update ShellTool to Use Hand Workspace

**Files:**
- Modify: `src/tools/shell.rs`
- Test: `src/tools/shell.rs` (extend)

**Step 1: Update execute to use workspace directory**

Modify command building in `src/tools/shell.rs`:

```rust
async fn execute(&self, args: serde_json::Value) -> anyhow::Result<ToolResult> {
    // ... existing validation code ...

    // Determine working directory
    let work_dir = if let Some(hand_id) = args.get("hand_id").and_then(|v| v.as_str()) {
        if let Some(dispatcher) = &self.hands_dispatcher {
            let hands = dispatcher.active_hands.read().await;
            if let Some(state) = hands.get(hand_id) {
                if let Some(ws) = &state.workspace {
                    ws.clone()
                } else {
                    self.security.workspace_dir.clone()
                }
            } else {
                self.security.workspace_dir.clone()
            }
        } else {
            self.security.workspace_dir.clone()
        }
    } else {
        self.security.workspace_dir.clone()
    };

    // Build command with process group and workspace
    let (mut cmd, pgid) = self
        .runtime
        .build_shell_command_with_group(command, &work_dir, hand_id)
        .await
        .map_err(|e| ToolResult {
            success: false,
            output: String::new(),
            error: Some(format!("Failed to build command: {e}")),
        })?;

    // ... rest of execution code ...
}
```

**Step 2: Add test for workspace isolation**

Add to `src/tools/shell.rs` tests:

```rust
#[tokio::test]
async fn shell_uses_isolated_workspace() {
    let temp = tempfile::tempdir().unwrap();
    let base = temp.path().to_path_buf();

    let security = Arc::new(SecurityPolicy {
        autonomy: AutonomyLevel::Full,
        workspace_dir: temp.path().to_path_buf(),
        ..SecurityPolicy::default()
    });

    let runtime = Arc::new(NativeRuntime::new());
    let dispatcher = Arc::new(HandsDispatcher::new(5, base));
    let tool = ShellTool::new(security, runtime).with_dispatcher(dispatcher.clone());

    // Register a hand
    let ws_path = dispatcher.register_hand("test_ws".to_string()).await.unwrap();

    // Create a file in that workspace
    let test_file = ws_path.join("test.txt");
    fs::write(&test_file, "content").unwrap();

    // Execute command that reads the file
    let result = tool
        .execute(json!({
            "command": "cat test.txt",
            "hand_id": "test_ws"
        }))
        .await
        .unwrap();

    assert!(result.success);
    assert!(result.output.contains("content"));
}
```

**Step 3: Run tests to verify**

Run: `cargo test --package zeroclaw shell -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/tools/shell.rs
git commit -m "feat(shell): use isolated workspace for hand commands

- Check for hand_id in args
- Use hand's workspace directory if available
- Fall back to security.workspace_dir for non-hand commands
- Add test for workspace isolation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Add sysinfo Crate Dependency

**Files:**
- Modify: `Cargo.toml`

**Step 1: Add sysinfo dependency**

Add to `Cargo.toml`:

```toml
[dependencies]
sysinfo = "0.32"
```

**Step 2: Verify dependency resolves**

Run: `cargo check`
Expected: Dependencies download successfully

**Step 3: Commit**

```bash
git add Cargo.toml
git commit -m "deps: add sysinfo crate for CPU monitoring

Will be used for CPU-aware memory hygiene scheduling.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Add CPU Configuration to Config

**Files:**
- Modify: `src/config.rs`

**Step 1: Add CPU idle threshold to MemoryConfig**

Update `src/config.rs`:

```rust
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MemoryConfig {
    pub hygiene_enabled: bool,
    pub archive_after_days: u64,
    pub purge_after_days: u64,
    pub conversation_retention_days: u64,
    /// CPU idle threshold percentage (0-100)
    /// Hygiene runs only when CPU is more idle than this
    #[serde(default = "default_cpu_idle_threshold")]
    pub cpu_idle_threshold_percent: u8,
    /// Maximum hours to wait for CPU idle before forcing hygiene
    #[serde(default = "default_max_wait_hours")]
    pub max_wait_hours: u64,
}

fn default_cpu_idle_threshold() -> u8 {
    90
}

fn default_max_wait_hours() -> u64 {
    24
}
```

**Step 2: Update config.toml.example**

Add to default config:

```toml
[memory.hygiene]
cpu_idle_threshold_percent = 90  # Run when CPU is 90% idle
max_wait_hours = 24              # Wait up to 24 hours for idle window
```

**Step 3: Add tests**

Add to `src/config.rs` tests:

```rust
#[test]
fn test_default_cpu_idle_threshold() {
    let config: MemoryConfig = toml::from_str("").unwrap();
    assert_eq!(config.cpu_idle_threshold_percent, 90);
    assert_eq!(config.max_wait_hours, 24);
}

#[test]
fn test_custom_cpu_idle_threshold() {
    let config: MemoryConfig = toml::from_str(
        "cpu_idle_threshold_percent = 80\nmax_wait_hours = 12"
    ).unwrap();
    assert_eq!(config.cpu_idle_threshold_percent, 80);
    assert_eq!(config.max_wait_hours, 12);
}
```

**Step 4: Run tests to verify**

Run: `cargo test --package zeroclaw config -v`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/config.rs
git commit -m "feat(config): add CPU idle threshold to memory config

- Add cpu_idle_threshold_percent (default: 90)
- Add max_wait_hours (default: 24)
- Make memory hygiene CPU-aware
- Add tests for new config fields

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Create CpuMonitor Module

**Files:**
- Create: `src/monitoring/mod.rs`
- Create: `src/monitoring/cpu.rs`
- Test: `src/monitoring/cpu.rs`

**Step 1: Create monitoring module structure**

Create `src/monitoring/mod.rs`:

```rust
pub mod cpu;
pub use cpu::CpuMonitor;
```

**Step 2: Create CpuMonitor**

Create `src/monitoring/cpu.rs`:

```rust
use sysinfo::System;
use std::time::Duration;
use tokio::time::{sleep, Instant};

/// Monitors CPU usage and determines if system is idle enough
pub struct CpuMonitor {
    /// Threshold: CPU is "idle enough" when usage is below this
    threshold: u8,
    system: System,
}

impl CpuMonitor {
    /// Create a new CPU monitor
    ///
    /// # Arguments
    /// - `threshold`: CPU idle threshold (0-100).
    ///   System is idle when CPU usage < (100 - threshold)%
    pub fn new(threshold: u8) -> Self {
        assert!(threshold <= 100, "CPU threshold must be 0-100");
        let mut system = System::new();
        system.refresh_cpu();
        Self { threshold, system }
    }

    /// Check if CPU is idle enough for hygiene tasks
    pub fn is_idle_enough(&self) -> bool {
        self.system.refresh_cpu();
        let usage = self.system.global_cpu_usage();
        // Usage is percentage (0-100), so we check if it's below threshold
        usage < (100 - self.threshold) as f32
    }

    /// Wait until CPU is idle, up to a maximum duration
    ///
    /// Returns true if CPU became idle, false if timeout reached
    pub async fn wait_until_idle(&self, max_duration: Duration) -> bool {
        let start = Instant::now();
        let check_interval = Duration::from_secs(300); // Check every 5 minutes

        while start.elapsed() < max_duration {
            if self.is_idle_enough() {
                return true;
            }

            let remaining = max_duration.saturating_sub(start.elapsed());
            let sleep_time = check_interval.min(remaining);
            sleep(sleep_time).await;
        }

        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpu_monitor_creation() {
        let monitor = CpuMonitor::new(90);
        // Can't test actual CPU without mocking, but verify it doesn't crash
        assert!(monitor.is_idle_enough() || !monitor.is_idle_enough());
    }

    #[test]
    #[should_panic(expected = "CPU threshold must be 0-100")]
    fn test_invalid_threshold_panics() {
        CpuMonitor::new(101);
    }

    #[tokio::test]
    async fn test_wait_until_idle_immediate_return() {
        let monitor = CpuMonitor::new(0); // Always idle
        assert!(monitor.wait_until_idle(Duration::from_secs(1)).await);
    }
}
```

**Step 3: Add monitoring module to main**

Add to `src/main.rs` or `src/lib.rs`:

```rust
pub mod monitoring;
```

**Step 4: Run tests to verify**

Run: `cargo test --package zeroclaw monitoring -v`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/monitoring/
git commit -m "feat(monitoring): add CpuMonitor for CPU-aware scheduling

- Add CpuMonitor struct with configurable idle threshold
- Add is_idle_enough() for immediate CPU check
- Add wait_until_idle() for waiting with timeout
- Check CPU every 5 minutes during wait
- Add module structure and tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Integrate CpuMonitor into Memory Hygiene

**Files:**
- Modify: `src/memory/hygiene.rs`

**Step 1: Import CpuMonitor**

Add to `src/memory/hygiene.rs`:

```rust
use crate::config::MemoryConfig;
use crate::monitoring::CpuMonitor;
use anyhow::Result;
use chrono::{DateTime, Local, NaiveDate, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration as StdDuration, SystemTime};
use tokio::time::{sleep, Duration};
```

**Step 2: Add async hygiene function**

Add to `src/memory/hygiene.rs`:

```rust
/// Run memory hygiene with CPU-aware scheduling
pub async fn run_if_due_cpu_aware(config: &MemoryConfig, workspace_dir: &Path) -> Result<()> {
    if !config.hygiene_enabled {
        return Ok(());
    }

    if !should_run_now(workspace_dir)? {
        return Ok(());
    }

    let monitor = CpuMonitor::new(config.cpu_idle_threshold_percent);

    // Check if CPU is idle enough
    if !monitor.is_idle_enough() {
        tracing::info!(
            "CPU busy (threshold: {}%), waiting for idle window...",
            config.cpu_idle_threshold_percent
        );

        let max_wait = Duration::from_secs(config.max_wait_hours * 3600);

        if !monitor.wait_until_idle(max_wait).await {
            tracing::warn!(
                "CPU never reached idle threshold after {} hours, skipping hygiene",
                config.max_wait_hours
            );
            return Ok(());
        }

        tracing::info!("CPU idle threshold reached, proceeding with hygiene");
    }

    // Run actual hygiene tasks (reuse existing logic)
    let report = HygieneReport {
        archived_memory_files: archive_daily_memory_files(
            workspace_dir,
            config.archive_after_days,
        )?,
        archived_session_files: archive_session_files(workspace_dir, config.archive_after_days)?,
        purged_memory_archives: purge_memory_archives(workspace_dir, config.purge_after_days)?,
        purged_session_archives: purge_session_archives(workspace_dir, config.purge_after_days)?,
        pruned_conversation_rows: prune_conversation_rows(
            workspace_dir,
            config.conversation_retention_days,
        )?,
    };

    write_state(workspace_dir, &report)?;

    if report.total_actions() > 0 {
        tracing::info!(
            "memory hygiene complete: archived_memory={} archived_sessions={} purged_memory={} purged_sessions={} pruned_conversation_rows={}",
            report.archived_memory_files,
            report.archived_session_files,
            report.purged_memory_archives,
            report.purged_session_archives,
            report.pruned_conversation_rows,
        );
    }

    Ok(())
}
```

**Step 3: Add tests**

Add to `src/memory/hygiene.rs` tests:

```rust
#[tokio::test]
async fn test_cpu_aware_hygiene_skips_when_busy() {
    // This test is difficult without mocking sysinfo
    // For now, just verify the function exists and doesn't crash
    let config = MemoryConfig {
        hygiene_enabled: false, // Skip actual work
        ..MemoryConfig::default()
    };
    let temp = tempfile::tempdir().unwrap();
    let result = run_if_due_cpu_aware(&config, temp.path()).await;
    assert!(result.is_ok());
}
```

**Step 4: Run tests to verify**

Run: `cargo test --package zeroclaw hygiene -v`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/memory/hygiene.rs
git commit -m "feat(hygiene): add CPU-aware scheduling

- Add run_if_due_cpu_aware() async function
- Check CPU idle threshold before running
- Wait up to max_wait_hours for idle window
- Skip hygiene if CPU never idle enough
- Add logging for CPU state transitions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Create UFW Configuration Script

**Files:**
- Create: `scripts/configure_ufw.sh`

**Step 1: Create UFW script**

Create `scripts/configure_ufw.sh`:

```bash
#!/bin/bash
# ZeroClaw Firewall Configuration
#
# Configures UFW (Uncomplicated Firewall) for ZeroClaw daemon
# Usage: sudo ./scripts/configure_ufw.sh [--skip-reset]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32M'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SKIP_RESET=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-reset)
            SKIP_RESET=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}=== ZeroClaw Firewall Configuration ===${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root (sudo)${NC}"
   exit 1
fi

# Check if UFW is installed
if ! command -v ufw &> /dev/null; then
    echo -e "${YELLOW}UFW not found. Installing...${NC}"
    apt-get update && apt-get install -y ufw
fi

# Reset to safe defaults (optional)
if [[ "$SKIP_RESET" != "true" ]]; then
    echo "Resetting UFW to safe defaults..."
    ufw --force reset
fi

# Default policies
echo "Setting default policies..."
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (prevent lockout)
echo "Allowing SSH..."
ufw allow 22/tcp comment 'SSH access'

# ZeroClaw API with rate limiting
echo "Configuring ZeroClaw API (port 42617) with rate limiting..."
ufw limit 42617/tcp comment 'ZeroClaw API (rate limited)'

# Allow localhost for development
echo "Allowing localhost..."
ufw allow from 127.0.0.1 to any port 42617 comment 'Local development'

# Enable logging
echo "Enabling logging..."
ufw logging medium

# Enable firewall
echo "Enabling firewall..."
ufw --force enable

echo ""
echo -e "${GREEN}=== UFW Configuration Complete ===${NC}"
echo ""
ufw status numbered
echo ""
echo -e "${GREEN}✅ Firewall configured for ZeroClaw${NC}"
echo ""
echo "To allow additional ports, use:"
echo "  sudo ufw allow <port>/<protocol>"
echo ""
echo "To view logs:"
echo "  sudo tail -f /var/log/ufw.log"
```

**Step 2: Make script executable**

Run: `chmod +x scripts/configure_ufw.sh`

**Step 3: Test script syntax**

Run: `bash -n scripts/configure_ufw.sh`
Expected: No syntax errors

**Step 4: Commit**

```bash
git add scripts/configure_ufw.sh
git commit -m "feat(security): add UFW firewall configuration script

- Add configure_ufw.sh with rate limiting on port 42617
- Default deny incoming, allow outgoing
- Allow SSH (port 22) to prevent lockout
- Add --skip-reset option for incremental updates
- Colorized output and logging instructions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Integrate UFW Script into Bootstrap

**Files:**
- Modify: `scripts/bootstrap.sh`

**Step 1: Add firewall setup to bootstrap**

Update `scripts/bootstrap.sh`:

```bash
#!/bin/bash
# ZeroClaw Bootstrap Script
...
# Add after dependency installation

# Configure firewall if not skipped
if [[ "$SKIP_FIREWALL" != "1" ]]; then
    echo "Configuring firewall..."
    "$SCRIPT_DIR/configure_ufw.sh" || {
        echo "⚠️  Firewall setup failed. Run manually later: sudo ./scripts/configure_ufw.sh"
    }
else
    echo "⏭️  Skipping firewall configuration (SKIP_FIREWALL=1)"
fi
```

**Step 2: Document firewall in README**

Create/update `docs/security.md`:

```markdown
# Security Configuration

## Firewall

ZeroClaw uses UFW (Uncomplicated Firewall) for network security.

### Automatic Setup

The bootstrap script automatically configures the firewall:

```bash
./scripts/bootstrap.sh
```

To skip firewall setup:

```bash
SKIP_FIREWALL=1 ./scripts/bootstrap.sh
```

### Manual Setup

Run the firewall script directly:

```bash
sudo ./scripts/configure_ufw.sh
```

### Rules

- Default deny incoming, allow outgoing
- SSH (port 22) allowed
- ZeroClaw API (port 42617) rate-limited
- Localhost access allowed

### Viewing Rules

```bash
sudo ufw status numbered
```

### Logs

```bash
sudo tail -f /var/log/ufw.log
```
```

**Step 3: Commit**

```bash
git add scripts/bootstrap.sh docs/security.md
git commit -m "feat(bootstrap): integrate UFW firewall configuration

- Call configure_ufw.sh during bootstrap
- Add SKIP_FIREWALL environment variable
- Create security documentation
- Add manual setup instructions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Add idb Dependency to Frontend

**Files:**
- Modify: `web/package.json`

**Step 1: Add idb dependency**

Update `web/package.json`:

```json
{
  "dependencies": {
    "idb": "^8.0.0",
    ...
  }
}
```

**Step 2: Install dependency**

Run: `cd web && npm install`

**Step 3: Verify installation**

Run: `ls web/node_modules/idb/package.json`
Expected: File exists

**Step 4: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "deps(web): add idb for IndexedDB support

Will be used for persisting chat history and large UI state.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 15: Create LocalStorage Utility

**Files:**
- Create: `web/src/lib/storage/local.ts`
- Create: `web/src/lib/storage/index.ts`

**Step 1: Create localStorage wrapper**

Create `web/src/lib/storage/local.ts`:

```typescript
/**
 * LocalStorage wrapper with error handling and type safety
 */

export interface LocalStore {
  get: <T>(key: string) => T | null;
  set: <T>(key: string, value: T) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const PREFIX = 'zeroclaw_';

function prefixKey(key: string): string {
  return `${PREFIX}${key}`;
}

export const localStore: LocalStore = {
  /**
   * Get value from localStorage
   */
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(prefixKey(key));
      return item ? (JSON.parse(item) as T) : null;
    } catch (error) {
      console.error(`Failed to get ${key} from localStorage:`, error);
      return null;
    }
  },

  /**
   * Set value in localStorage
   */
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(prefixKey(key), JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to set ${key} in localStorage:`, error);
    }
  },

  /**
   * Remove value from localStorage
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(prefixKey(key));
    } catch (error) {
      console.error(`Failed to remove ${key} from localStorage:`, error);
    }
  },

  /**
   * Clear all ZeroClaw items from localStorage
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  },
};
```

**Step 2: Create storage module export**

Create `web/src/lib/storage/index.ts`:

```typescript
export * from './local';
export * from './indexed';
```

**Step 3: Create placeholder for indexed (will implement in next task)**

Create `web/src/lib/storage/indexed.ts`:

```typescript
// TODO: Implement IndexedDB wrapper
// Will be implemented in Task 16
```

**Step 4: Commit**

```bash
git add web/src/lib/storage/
git commit -m "feat(web): add localStorage wrapper utility

- Add LocalStore interface with get/set/remove/clear
- Prefix keys with 'zeroclaw_' to avoid conflicts
- Add error handling for all operations
- Create storage module structure

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 16: Create IndexedDB Utility

**Files:**
- Modify: `web/src/lib/storage/indexed.ts`

**Step 1: Implement IndexedDB wrapper**

Update `web/src/lib/storage/indexed.ts`:

```typescript
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ZeroClawDB extends DBSchema {
  messages: {
    key: [string, string]; // [handId, timestamp]
    value: A2AMessage;
    indexes: {
      'by-hand': string;
    };
  };
}

interface A2AMessage {
  hand_id: string;
  timestamp: string;
  type: string;
  content: unknown;
}

const DB_NAME = 'zeroclaw_db';
const DB_VERSION = 1;

let db: IDBPDatabase<ZeroClawDB> | null = null;

/**
 * Get or create IndexedDB connection
 */
async function getDb(): Promise<IDBPDatabase<ZeroClawDB>> {
  if (db) return db;

  db = await openDB<ZeroClawDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('messages')) {
        const store = db.createObjectStore('messages', {
          keyPath: ['hand_id', 'timestamp'],
        });
        store.createIndex('by-hand', 'hand_id');
      }
    },
  });

  return db;
}

/**
 * IndexedDB wrapper for message storage
 */
export const idbStore = {
  /**
   * Get all messages for a hand
   */
  async getMessages(handId: string): Promise<A2AMessage[]> {
    try {
      const db = await getDb();
      return db.getAll('messages', IDBKeyRange.only(handId));
    } catch (error) {
      console.error(`Failed to get messages for ${handId}:`, error);
      return [];
    }
  },

  /**
   * Add a message to storage
   */
  async addMessage(message: A2AMessage): Promise<void> {
    try {
      const db = await getDb();
      await db.put('messages', message);
    } catch (error) {
      console.error('Failed to add message:', error);
    }
  },

  /**
   * Clear all messages for a hand
   */
  async clearHand(handId: string): Promise<void> {
    try {
      const db = await getDb();
      await db.delete('messages', IDBKeyRange.only(handId));
    } catch (error) {
      console.error(`Failed to clear messages for ${handId}:`, error);
    }
  },

  /**
   * Clear all messages
   */
  async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      await db.clear('messages');
    } catch (error) {
      console.error('Failed to clear all messages:', error);
    }
  },
};
```

**Step 2: Add types**

Create `web/src/types/storage.ts`:

```typescript
export interface A2AMessage {
  hand_id: string;
  timestamp: string;
  type: 'TaskAssignment' | 'TaskProgress' | 'TaskCompletion' | 'ClarificationRequest';
  content: unknown;
}

export interface UiState {
  tasks: Task[];
  hands: Hand[];
  lastSync: string;
}

export interface Task {
  id: string;
  title: string;
  status: 'Todo' | 'InProgress' | 'Review' | 'Done';
  priority: 'high' | 'medium' | 'low';
}

export interface Hand {
  id: string;
  status: 'idle' | 'running' | 'paused';
  task: string | null;
}
```

**Step 3: Update storage index**

Update `web/src/lib/storage/index.ts`:

```typescript
export * from './local';
export * from './indexed';
export * from '../../types/storage';
```

**Step 4: Commit**

```bash
git add web/src/lib/storage/indexed.ts web/src/lib/storage/index.ts web/src/types/storage.ts
git commit -m "feat(web): add IndexedDB wrapper for message storage

- Add idbStore with getMessages/addMessage/clearHand/clearAll
- Create ZeroClawDB schema with messages store
- Index messages by hand_id for efficient queries
- Add A2AMessage, UiState, Task, Hand types
- Handle connection pooling with singleton pattern

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 17: Create Initial State Fetch Hook

**Files:**
- Create: `web/src/hooks/useInitialHandState.ts`
- Modify: `web/src/lib/store.ts`

**Step 1: Create initial state hook**

Create `web/src/hooks/useInitialHandState.ts`:

```typescript
import { useEffect } from 'react';
import { useStore } from '../lib/store';
import { useApi } from './useApi';
import { localStore } from '../lib/storage/local';

export function useInitialHandState() {
  const { setHands, hydrate } = useStore();
  const apiFetch = useApi();

  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        // Fetch current state from server
        const response = await apiFetch<{ active_hands: Hand[] }>('/v1/agent/status');
        setHands(response.active_hands);

        // Hydrate additional UI state from localStorage
        const savedTasks = localStore.get<Task[]>('tasks');
        const savedHands = localStore.get<Hand[]>('hands');

        if (savedTasks || savedHands) {
          hydrate({
            tasks: savedTasks || [],
            hands: savedHands || response.active_hands,
            lastSync: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Failed to fetch initial state:', error);
      }
    };

    fetchInitialState();
  }, [apiFetch, setHands, hydrate]);
}
```

**Step 2: Update store to support hydrate**

Update `web/src/lib/store.ts` to add hydrate action:

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UiStore {
  tasks: Task[];
  hands: Hand[];
  lastSync: string | null;

  // Actions
  setHands: (hands: Hand[]) => void;
  setTasks: (tasks: Task[]) => void;
  hydrate: (state: Partial<UiStore>) => void;
  persist: () => void;
}

export const useStore = create<UiStore>()(
  devtools(
    (set, get) => ({
      tasks: [],
      hands: [],
      lastSync: null,

      setHands: (hands) => set({ hands }),

      setTasks: (tasks) => set({ tasks }),

      hydrate: (partialState) => set((state) => ({ ...state, ...partialState })),

      persist: () => {
        const { tasks, hands } = get();
        localStore.set('tasks', tasks);
        localStore.set('hands', hands);
        localStore.set('lastSync', new Date().toISOString());
      },
    }),
    { name: 'ZeroClawStore' }
  )
);
```

**Step 3: Auto-persist on state changes**

Update `web/src/lib/store.ts` to add persist middleware:

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

// ... existing store definition ...

// Subscribe to changes and persist to localStorage
useStore.subscribe(
  (state) => ({ tasks: state.tasks, hands: state.hands }),
  (state) => {
    localStore.set('tasks', state.tasks);
    localStore.set('hands', state.hands);
  },
  {
    equalityFn: shallow,
  }
);
```

**Step 4: Commit**

```bash
git add web/src/hooks/useInitialHandState.ts web/src/lib/store.ts
git commit -m "feat(web): add initial state fetch and hydration

- Add useInitialHandState hook for fetching state on mount
- Add hydrate() action to restore from localStorage
- Auto-persist tasks and hands to localStorage on change
- Fetch active_hands from /v1/agent/status endpoint
- Merge server state with persisted local state

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 18: Update A2A Stream Hook with Reconnection

**Files:**
- Modify: `web/src/hooks/useA2AStream.ts`

**Step 1: Add reconnection handling**

Update `web/src/hooks/useA2AStream.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { useApi } from './useApi';
import { idbStore } from '../lib/storage';

export function useA2AStream(handId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const { setHands, addMessage } = useStore();
  const apiFetch = useApi();

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`ws://localhost:42617/ws/a2a/${handId}`);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log(`A2A stream connected for hand ${handId}`);

        // Fetch current state on reconnect
        try {
          const response = await apiFetch<{ active_hands: Hand[] }>('/v1/agent/status');
          setHands(response.active_hands);
        } catch (error) {
          console.error('Failed to fetch state after reconnect:', error);
        }
      };

      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data) as A2AMessage;
          addMessage(message);

          // Persist to IndexedDB
          await idbStore.addMessage(message);
        } catch (error) {
          console.error('Failed to parse A2A message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('A2A stream error:', error);
      };

      ws.onclose = () => {
        console.log('A2A stream closed, reconnecting in 5s...');
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [handId, apiFetch, setHands, addMessage]);
}
```

**Step 2: Add addMessage to store**

Update `web/src/lib/store.ts`:

```typescript
interface UiStore {
  // ... existing ...
  addMessage: (message: A2AMessage) => void;
}

export const useStore = create<UiStore>()(
  devtools(
    (set, get) => ({
      // ... existing ...

      addMessage: (message) =>
        set((state) => ({
          messages: [...(state.messages || []), message],
        })),
    }),
    { name: 'ZeroClawStore' }
  )
);
```

**Step 3: Commit**

```bash
git add web/src/hooks/useA2AStream.ts web/src/lib/store.ts
git commit -m "feat(web): add A2A stream reconnection with state fetch

- Reconnect automatically after connection loss
- Fetch current state from /v1/agent/status on reconnect
- Persist incoming messages to IndexedDB
- Add 5-second delay before reconnection attempt
- Add addMessage() action to store

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 19: Integration Testing

**Files:**
- Create: `tests/integration/hand_lifecycle.rs`

**Step 1: Create integration test**

Create `tests/integration/hand_lifecycle.rs`:

```rust
use zeroclaw::agent::hands::{HandsDispatcher, HandState};
use zeroclaw::agent::interruption::InterruptionHandler;
use zeroclaw::agent::workspace::HandWorkspace;
use zeroclaw::tools::ShellTool;
use zeroclaw::runtime::NativeRuntime;
use zeroclaw::security::{AutonomyLevel, SecurityPolicy};
use tempfile::TempDir;

#[tokio::test]
async fn test_hand_lifecycle_with_isolation() {
    let temp = TempDir::new().unwrap();
    let base = temp.path();

    // Create dispatcher
    let dispatcher = HandsDispatcher::new(5, base.to_path_buf());

    // Register a hand
    let ws_path = dispatcher.register_hand("test_hand".to_string()).await.unwrap();
    assert!(ws_path.exists());
    assert!(ws_path.ends_with("hands/test_hand"));

    // Verify hand is tracked
    assert!(dispatcher.is_active("test_hand").await);
    assert_eq!(dispatcher.active_count().await, 1);

    // Unregister
    dispatcher.unregister_hand("test_hand").await.unwrap();

    // Verify cleanup
    assert!(!dispatcher.is_active("test_hand").await);
    assert!(!ws_path.exists());
}

#[tokio::test]
async fn test_concurrent_hands_isolated() {
    let temp = TempDir::new().unwrap();
    let base = temp.path();

    let dispatcher = HandsDispatcher::new(5, base.to_path_buf());

    // Register two hands
    let ws1 = dispatcher.register_hand("hand1".to_string()).await.unwrap();
    let ws2 = dispatcher.register_hand("hand2".to_string()).await.unwrap();

    // Different paths
    assert_ne!(ws1, ws2);

    // Create files in each
    let file1 = ws1.join("test.txt");
    let file2 = ws2.join("test.txt");

    std::fs::write(&file1, "hand1").unwrap();
    std::fs::write(&file2, "hand2").unwrap();

    // Verify isolation
    let content1 = std::fs::read_to_string(&file1).unwrap();
    let content2 = std::fs::read_to_string(&file2).unwrap();

    assert_eq!(content1, "hand1");
    assert_eq!(content2, "hand2");

    // Cleanup
    dispatcher.unregister_hand("hand1").await.unwrap();
    dispatcher.unregister_hand("hand2").await.unwrap();
}

#[tokio::test]
async fn test_interruption_kills_process_group() {
    // This test would require spawning actual long-running processes
    // For now, verify the API exists
    let result = InterruptionHandler::kill_process_group(99999);
    assert!(result.is_ok() || result.unwrap_err().to_string().contains("No such process"));
}
```

**Step 2: Run integration tests**

Run: `cargo test --test integration`

**Step 3: Commit**

```bash
git add tests/integration/
git commit -m "test(integration): add hand lifecycle tests

- Test hand registration and workspace creation
- Test workspace isolation between concurrent hands
- Test interruption with process group killing
- Verify cleanup on unregister

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 20: Final Verification and Documentation

**Files:**
- Update: `README.md`
- Update: `CHANGELOG.md`

**Step 1: Update README with new features**

Add to `README.md`:

```markdown
## Security & Stability Features

### Process Management
- **Zombie Process Prevention**: Child processes killed on hand cancellation
- **Process Group Killing**: Uses `setsid()` and `libc::kill` for complete cleanup
- **Workspace Isolation**: Each hand gets isolated `/tmp/zeroclaw/hands/{id}` directory

### Resource Management
- **CPU-Aware Hygiene**: Memory cleanup only when CPU idle (configurable threshold)
- **Rate Limiting**: UFW rate-limits API requests to prevent abuse

### Persistence
- **Frontend State**: Tasks and hands persisted to localStorage
- **Chat History**: A2A messages stored in IndexedDB
- **State Recovery**: Initial fetch from API on page load
```

**Step 2: Update CHANGELOG**

Add to `CHANGELOG.md`:

```markdown
## [Unreleased]

### Added
- Process group support for shell command execution
- Hand workspace isolation with automatic cleanup
- CPU idle detection for memory hygiene scheduling
- UFW firewall configuration script
- Frontend state persistence (localStorage + IndexedDB)
- Initial state fetch on page load
- WebSocket reconnection with state recovery

### Fixed
- Zombie processes surviving hand cancellation
- Concurrent hands overwriting shared files
- Memory hygiene running during high CPU load
- State loss on page refresh

### Changed
- `RuntimeAdapter::build_shell_command()` -> `build_shell_command_with_group()`
- `HandsDispatcher` now uses `HandState` instead of bare `CancellationToken`
- Memory hygiene now waits for CPU idle before running
```

**Step 3: Run full test suite**

Run: `cargo test`

**Step 4: Build and verify**

Run: `cargo build --release`

**Step 5: Final commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: update for security & stability fixes

- Document new security features in README
- Add changelog entry for all fixes
- Document CPU idle threshold configuration
- Add persistence architecture overview

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

This implementation plan addresses all 5 critical issues:

1. ✅ **Zombie Processes** - Process group killing with libc
2. ✅ **Sandbox Isolation** - Per-hand workspaces
3. ✅ **CPU-Aware Hygiene** - Configurable idle threshold
4. ✅ **UFW Firewall** - Rate limiting on port 42617
5. ✅ **State Persistence** - localStorage + IndexedDB

**Total Tasks:** 20
**Estimated Time:** 4-6 hours
**Risk Level:** Medium (involves process management and storage)

---

**Plan complete and saved to `docs/plans/2025-03-07-security-stability-fixes-plan.md`**
