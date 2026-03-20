# TMA Hub Per-Conversation Skills Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable TMA Hub threads to have their own set of enabled skills that the bot actually uses when processing messages from that conversation.

**Architecture:** Pass thread-specific skills through the message processing pipeline, from Telegram channel → agent loop → system prompt, filtering the global skill list to only include enabled skills per conversation.

**Tech Stack:** Rust, axum, tokio, mpsc channels

---

## Overview

Currently, the ZeroClaw system loads ALL skills globally at daemon startup and includes them in every conversation. TMA Hub allows users to create threads and toggle skills per thread, but this information is stored in-memory and never used.

This plan modifies the message processing pipeline to:
1. Extract thread_id from incoming messages
2. Look up enabled skills for that thread
3. Filter skills to only include enabled ones
4. Pass filtered skills to the agent for system prompt generation

---

## File Structure

**Files to modify:**
- `src/agent/loop_.rs` - Add optional skills parameter, use provided skills instead of loading all
- `src/channels/mod.rs` - Pass thread skills when calling agent, add thread skills lookup helper
- `src/channels/telegram.rs` - Already passes thread_ts, no changes needed
- `src/gateway/telegram_threads.rs` - Already stores thread→skills mapping, add public accessor

**No new files** - This is a focused modification of existing code paths.

---

## Chunk 1: Add Thread Skills to Channel Message

**Rationale:** The `ChannelMessage` struct currently carries thread context via `thread_ts`, but we need a way to pass the list of enabled skill names from the channel layer to the agent layer.

**Files:**
- Modify: `src/channels/traits.rs`

- [ ] **Step 1: Add `active_skills` field to ChannelMessage**

```rust
#[derive(Debug, Clone)]
pub struct ChannelMessage {
    pub id: String,
    pub sender: String,
    pub reply_target: String,
    pub content: String,
    pub channel: String,
    pub timestamp: u64,
    /// Platform thread identifier (e.g. Slack `ts`, Discord thread ID).
    /// When set, replies should be posted as threaded responses.
    pub thread_ts: Option<String>,
    /// Active skill names for this thread (from TMA Hub or other thread management)
    pub active_skills: Vec<String>,
}
```

- [ ] **Step 2: Update all ChannelMessage creation sites to include empty skills**

```bash
# Run to find all creation sites:
grep -rn "ChannelMessage {" src/ --include="*.rs"
```

For each match (in telegram.rs, discord.rs, etc.), add:
```rust
active_skills: vec![],  // Default to no active skills
```

Run: `~/.cargo/bin/cargo check 2>&1 | grep "active_skills"`
Expected: No new errors (field is optional with default vec![])

- [ ] **Step 3: Commit**

```bash
git add src/channels/traits.rs
git commit -m "feat(channels): add active_skills field to ChannelMessage"
```

---

## Chunk 2: Pass Thread Skills in Telegram Channel

**Rationale:** When processing a webhook/polling update, look up the TMA Hub thread's enabled skills and populate the `active_skills` field.

**Files:**
- Modify: `src/channels/telegram.rs`

- [ ] **Step 1: Update imports to include skills lookup function**

```rust
// Add to existing imports:
use crate::gateway::telegram_threads::get_skills_for_telegram_chat;
```

- [ ] **Step 2: Modify webhook message processing to fetch skills**

Find the section:
```rust
// 🔄 TMA HUB INTEGRATION: Look up TMA Hub thread for this chat
let chat_id_for_thread = msg.reply_target.split(':').next().unwrap_or(&msg.reply_target);
if let Some(tma_thread_id) = get_thread_id_for_telegram_chat(chat_id_for_thread).await {
    tracing::info!("📌 TMA Hub: Using thread {} for chat {}", tma_thread_id, chat_id_for_thread);
    msg.thread_ts = Some(tma_thread_id);
}
```

Replace with:
```rust
// 🔄 TMA HUB INTEGRATION: Look up TMA Hub thread for this chat
let chat_id_for_thread = msg.reply_target.split(':').next().unwrap_or(&msg.reply_target);
if let Some(tma_thread_id) = get_thread_id_for_telegram_chat(chat_id_for_thread).await {
    tracing::info!("📌 TMA Hub: Using thread {} for chat {}", tma_thread_id, chat_id_for_thread);
    msg.thread_ts = Some(tma_thread_id);

    // Fetch enabled skills for this thread
    let enabled_skills = get_skills_for_telegram_chat(chat_id_for_thread).await;
    msg.active_skills = enabled_skills;
    if !enabled_skills.is_empty() {
        tracing::info!("🛠️ TMA Hub: Enabled skills: {:?}", enabled_skills);
    }
}
```

- [ ] **Step 3: Do the same for polling mode**

Find the similar section in `listen_polling` and make the same change.

- [ ] **Step 4: Test compilation**

Run: `~/.cargo/bin/cargo check 2>&1 | tail -20`
Expected: No errors, only warnings

- [ ] **Step 5: Commit**

```bash
git add src/channels/telegram.rs
git commit -m "feat(telegram): populate active_skills from TMA Hub thread"
```

---

## Chunk 3: Pass Thread Skills to Agent Loop (Channel Layer)

**Rationale:** The channel layer receives messages with `active_skills` populated. Now we need to pass this through to the agent processing.

**Files:**
- Modify: `src/channels/mod.rs`

- [ ] **Step 1: Create helper function to load skills by name**

Add after `build_system_prompt_with_mode`:

```rust
/// Load skills by name from the global skill list.
/// Returns only skills whose names match the provided list.
/// If enabled_skills is empty, returns all skills (default behavior).
pub fn load_skills_by_name(
    all_skills: &[crate::skills::Skill],
    enabled_skills: &[String],
) -> Vec<crate::skills::Skill> {
    if enabled_skills.is_empty() {
        // No skills specified - return all (backward compatible)
        return all_skills.to_vec();
    }

    all_skills
        .iter()
        .filter(|skill| enabled_skills.contains(&skill.name))
        .cloned()
        .collect()
}
```

- [ ] **Step 2: Find the message processing loop that calls run_tool_call_loop**

Search for where `run_tool_call_loop` is called. It should be in a function that processes `ChannelMessage`.

Look for pattern like:
```rust
let response = run_tool_call_loop(
    provider.as_ref(),
    &mut history,
    &tools_registry,
    // ... other params
);
```

The containing function should have access to `msg: &ChannelMessage`.

- [ ] **Step 3: Add skills filtering before build_system_prompt_with_mode**

Before the existing `build_system_prompt_with_mode` call in `run_tool_call_loop`, add:

```rust
// Filter skills based on thread's active skills
// Note: For now, we pass all skills as the thread_skills comes from a different layer
// This will be handled in a later chunk
```

- [ ] **Step 4: Commit**

```bash
git add src/channels/mod.rs
git commit -m "feat(channels): add load_skills_by_name helper"
```

---

## Chunk 4: Modify Agent Loop to Accept Thread Skills

**Rationale:** The agent loop currently loads ALL skills. We need to optionally accept a filtered list.

**Files:**
- Modify: `src/agent/loop_.rs`

- [ ] **Step 1: Find the skills loading in run_tool_call_loop**

Find:
```rust
let skills = crate::skills::load_skills_with_config(&config.workspace_dir, &config);
```

This is around line 2628 in the first `run_tool_call_loop` function.

- [ ] **Step 2: Add optional skills parameter to run_tool_call_loop**

Change the function signature to accept optional filtered skills:

Add parameter after `max_tool_iterations`:
```rust
thread_skills: Option<&[crate::skills::Skill]>,
```

Full signature (line 2537-2560 approximately):
```rust
pub async fn run_tool_call_loop(
    provider: &dyn Provider,
    history: &mut Vec<ChatMessage>,
    tools_registry: &[Box<dyn Tool>],
    observer: &dyn Observer,
    provider_name: &str,
    model: &str,
    temperature: f64,
    silent: bool,
    approval: Option<&ApprovalManager>,
    channel_name: &str,
    multimodal_config: &crate::config::MultimodalConfig,
    max_tool_iterations: usize,
    cancellation_token: Option<CancellationToken>,
    on_delta: Option<tokio::sync::mpsc::Sender<String>>,
    hooks: Option<&crate::hooks::HookRunner>,
    excluded_tools: &[String],
    thread_skills: Option<&[crate::skills::Skill]>,
) -> Result<String>
```

- [ ] **Step 3: Use thread_skills if provided, else load all skills**

Replace:
```rust
let skills = crate::skills::load_skills_with_config(&config.workspace_dir, &config);
```

With:
```rust
// Use thread-specific skills if provided, otherwise load all skills
let skills = if let Some(thread_skills) = thread_skills {
    thread_skills.to_vec()
} else {
    crate::skills::load_skills_with_config(&config.workspace_dir, &config)
};
```

- [ ] **Step 4: Update the second run_tool_call_loop (CLI mode)**

There's a second `run_tool_call_loop` function for CLI mode around line 3075. Make the same change:
- Add `thread_skills: Option<&[crate::skills::Skill]>` parameter
- Use the same conditional loading logic

- [ ] **Step 5: Fix all call sites of run_tool_call_loop**

Find all call sites and add `None` for the new parameter:

```bash
grep -rn "run_tool_call_loop(" src/ --include="*.rs"
```

For each match in `src/channels/mod.rs`, add `thread_skills: None,` before the last parameter.

Example:
```rust
let response = run_tool_call_loop(
    provider.as_ref(),
    &mut history,
    &tools_registry,
    observer.as_ref(),
    provider_name,
    model_name,
    temperature,
    silent,
    approval_manager.as_ref(),
    "telegram",
    &multimodal_config,
    max_iterations,
    cancellation_token.as_ref(),
    None,
    hooks.as_ref(),
    &[],
    thread_skills: None,  // NEW: Add this
).await?;
```

- [ ] **Step 6: Update CLI mode call site**

Find the CLI call site in `src/agent/loop_.rs` (in the CLI test) and add `None` for thread_skills.

- [ ] **Step 7: Test compilation**

Run: `~/.cargo/bin/cargo check 2>&1 | grep -E "error|thread_skills"`
Expected: No compilation errors

- [ ] **Step 8: Commit**

```bash
git add src/agent/loop_.rs
git commit -m "feat(agent): add optional thread_skills parameter to run_tool_call_loop"
```

---

## Chunk 5: Connect Channel Skills to Agent Loop

**Rationale:** Now we need to actually pass the thread skills from the ChannelMessage to the agent loop.

**Files:**
- Modify: `src/channels/mod.rs`

- [ ] **Step 1: Find where ChannelMessage carries active_skills**

The message processing loop should have:
```rust
async fn process_message(msg: &ChannelMessage, ctx: &RuntimeContext) -> anyhow::Result<()> {
```

- [ ] **Step 2: Load all skills once (cached)**

At the top of the message processing module, add:

```rust
// Cache all available skills to avoid repeated filesystem access
static ALL_SKILLS: OnceLock<Vec<crate::skills::Skill>> = OnceLock::new();
fn get_all_skills(config: &Config) -> &[crate::skills::Skill] {
    ALL_SKILLS.get_or_init(|| {
        crate::skills::load_skills_with_config(&config.workspace_dir, config)
    })
}
```

- [ ] **Step 3: Locate where agent gets skills**

Find where the agent is created or where system prompt is built with skills.

Look for:
- `build_system_prompt_with_mode` call
- Where `&skills` slice is passed

- [ ] **Step 4: Filter skills by msg.active_skills**

Before passing skills to the agent, filter them:

```rust
// Filter skills based on thread's active skills
let all_skills = get_all_skills(ctx.as_ref());
let filtered_skills = crate::channels::load_skills_by_name(
    all_skills,
    &msg.active_skills,
);
```

- [ ] **Step 5: Pass filtered_skills to run_tool_call_loop**

Find the `run_tool_call_loop` call and replace `thread_skills: None` with the filtered skills:

```rust
let filtered_skills: Vec<crate::skills::Skill> = // ... from step 4

let response = run_tool_call_loop(
    // ... other params ...
    thread_skills: Some(&filtered_skills),  // Changed from None
).await?;
```

- [ ] **Step 6: Test compilation**

Run: `~/.cargo/bin/cargo check 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/channels/mod.rs
git commit -m "feat(channels): filter and pass thread skills to agent"
```

---

## Chunk 6: Update Message Creation Sites with Empty Skills

**Rationale:** Ensure all ChannelMessage creations include the `active_skills` field so we don't have missing field errors.

**Files:**
- Modify: All files in `src/channels/` that create `ChannelMessage`

- [ ] **Step 1: Find all ChannelMessage creation sites**

```bash
grep -rn "ChannelMessage {" src/channels/ --include="*.rs"
```

- [ ] **Step 2: Add active_skills: vec![] to each creation**

Files to update based on grep results:
- `src/channels/telegram.rs` - Multiple sites (parse_update_message, try_parse_voice_message, etc.)
- `src/channels/discord.rs` (if exists and creates ChannelMessage)
- Any other channel implementation

Example fix:
```rust
ChannelMessage {
    id: "...".to_string(),
    sender: "...".to_string(),
    reply_target: "...".to_string(),
    content: "...".to_string(),
    channel: "...".to_string(),
    timestamp: 123,
    thread_ts: Some("...".to_string()),
    active_skills: vec![],  // ADD THIS
}
```

- [ ] **Step 3: Test compilation**

Run: `~/.cargo/bin/cargo check 2>&1 | tail -20`
Expected: No errors about missing `active_skills`

- [ ] **Step 4: Commit**

```bash
git add src/channels/
git commit -m "fix(channels): add active_skills to all ChannelMessage creations"
```

---

## Chunk 7: Rebuild and Test

**Rationale:** Verify the implementation works end-to-end.

- [ ] **Step 1: Build the daemon**

Run: `~/.cargo/bin/cargo build --release --bin zeroclaw 2>&1 | tail -10`
Expected: `Finished 'release' profile`

- [ ] **Step 2: Copy and restart daemon**

```bash
pkill -f zeroclaw
cp target/release/zeroclaw ~/.cargo/bin/zeroclaw
~/.cargo/bin/zeroclaw daemon 2>&1 &
```

- [ ] **Step 3: Create a test thread in TMA Hub**

1. Open TMA Hub in Telegram
2. Create new thread
3. Enable some skills (e.g., "web-search", "file-operations")
4. Send a message to the bot

- [ ] **Step 4: Verify in logs**

Look for:
```
📌 TMA Hub: Using thread thread_...
🛠️ TMA Hub: Enabled skills: ["web-search", "file-operations"]
```

- [ ] **Step 5: Test skill activation**

Send message: "Use web-search to find recent Rust news"
Expected: Bot should use web-search tool

- [ ] **Step 6: Test with no skills**

1. Create new thread with NO skills enabled
2. Send message
Expected: Bot should still respond but without using skill-specific tools

- [ ] **Step 7: Test conversation isolation**

1. Thread A with skill X
2. Thread B with skill Y
3. Send messages to each
Expected: Each conversation uses only its enabled skills

- [ ] **Step 8: Commit final changes if working**

```bash
git add -A
git commit -m "feat: complete TMA Hub per-conversation skills integration"
```

---

## Testing Notes

**How to verify per-conversation skills:**

1. In TMA Hub, create "Coding" thread with skills: ["web-search", "file-operations"]
2. In TMA Hub, create "Research" thread with skills: ["memory", "web-search"]
3. Send "What's the weather?" to Coding thread → should use web-search
4. Send "Remember my API key is xyz" to Research thread → should use memory
5. Switch back to Coding thread and ask for file operations → should work

**Expected behavior:**
- Bot only uses tools from skills in the active thread
- System prompt only includes enabled skill instructions
- Different threads have completely different capabilities

**Backward compatibility:**
- If no thread is associated → all skills available (default behavior)
- If thread has no skills → all skills available
- Existing conversations without thread_ts → all skills available
