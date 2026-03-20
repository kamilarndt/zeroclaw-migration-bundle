# Per-Conversation Skills Fix

**Date:** 2026-03-14
**Status:** ✅ Implemented and Deployed

## Problem

The per-conversation skills feature was not working correctly. When a TMA Hub thread had specific skills enabled, the bot was still using ALL available skills instead of just the thread-specific skills.

### Root Cause

1. **Channel System Prompt Build:** At channel startup, `build_system_prompt_with_mode()` was called with ALL skills, creating a global system prompt containing the "## Available Skills" section with every skill.

2. **Thread Skills Injection:** When a message arrived with thread context, `run_tool_call_loop()` would APPEND thread-specific skills to the existing system prompt, resulting in:
   - Global "## Available Skills" section (all skills)
   - Additional thread-specific skills section appended

3. **Empty Skills Confusion:** When `filtered_skills` was empty (no skills enabled for thread), the code would pass `None` to `run_tool_call_loop()`, which meant "load all skills" instead of "use no skills".

## Solution

### Fix 1: Remove Global Skills Section When Thread Skills Are Provided

**File:** `src/agent/loop_.rs` (lines 1873-1915)

When `thread_skills` is provided (even if empty), the code now:
1. Finds and REMOVES the existing "## Available Skills...[content]...</available_skills>" section from the system prompt
2. Then adds the thread-specific skills (if any)

```rust
// Inject thread-specific skills into the system prompt if provided
if let Some(skills) = thread_skills {
    // When thread-specific skills are provided, replace the global skills section
    // with only the thread-specific skills (empty skills = no skills available)
    if let Some(system_msg) = history.first_mut() {
        // Remove the existing "## Available Skills" section if present
        if let Some(start_idx) = system_msg.content.find("## Available Skills") {
            let end_tag = "</available_skills>";
            if let Some(end_idx) = system_msg.content[start_idx..].find(end_tag) {
                let end_idx = start_idx + end_idx + end_tag.len();
                // Remove the skills section
                let before = system_msg.content[..start_idx].to_string();
                let after = system_msg.content[end_idx..].to_string();
                // Trim trailing newlines from "before" to avoid double newlines
                let before = before.trim_end_matches('\n').trim_end_matches('\n');
                system_msg.content = format!("{}\n\n{}", before, after.trim_start_matches('\n').trim_start_matches('\n'));
            }
        }

        // Now add the thread-specific skills (if any)
        if !skills.is_empty() {
            let skills_prompt = crate::skills::skills_to_prompt_with_mode(
                skills,
                &std::path::Path::new("."),
                crate::config::SkillsPromptInjectionMode::Full,
            );
            if !skills_prompt.is_empty() {
                system_msg.content = format!("{}\n\n{}", system_msg.content, skills_prompt);
            }
        }
    }
}
```

### Fix 2: Distinguish "No Thread" from "Thread with No Skills"

**File:** `src/channels/mod.rs` (lines 1742-1757)

The code now checks `msg.thread_ts` to determine if a thread context exists:
- `thread_ts = None` → No thread → `thread_skills_ref = None` (load all skills)
- `thread_ts = Some(_)` → Thread exists → `thread_skills_ref = Some(&filtered_skills)` (use filtered skills, even if empty)

```rust
// Filter skills based on thread's active skills
// If thread_ts is set, a thread context exists → use thread-specific skills (even if empty)
// If thread_ts is None → no thread context → load all skills (None)
let filtered_skills: Vec<crate::skills::Skill> = if msg.thread_ts.is_some() {
    // Thread exists: filter skills by active_skills (empty vec = no skills for this thread)
    load_skills_by_name(&ctx.all_skills, &msg.active_skills)
} else {
    // No thread: we'll use None to load all skills
    vec![]
};

let thread_skills_ref: Option<&[crate::skills::Skill]> = if msg.thread_ts.is_some() {
    Some(&filtered_skills)
} else {
    None
};
```

## Testing

To test the fix:

1. **Create a thread in TMA Hub** with specific skills enabled
2. **Send a message** to the Telegram bot
3. **Expected behavior:** Bot should only use the enabled skills

### Test Cases

| Thread Skills | Expected Behavior |
|---------------|-------------------|
| `web-search-api` only | Bot only uses web search, not other skills |
| Empty (no skills enabled) | Bot has NO skills available |
| No thread created | Bot uses ALL skills (default) |

## Verification

```bash
# Check daemon is running
ps aux | grep zeroclaw

# Check logs for TMA Hub integration
tail -f /tmp/zeroclaw-daemon.log | grep "TMA Hub"
```

Look for log messages like:
```
📌 TMA Hub: Using thread <thread_id> for chat <chat_id>
🛠️ TMA Hub: Enabled skills: ["skill1", "skill2"]
```

## Files Modified

1. `/home/ubuntu/zeroclaw-migration-bundle/backend/src/agent/loop_.rs`
   - Modified thread skills injection to remove global skills section first

2. `/home/ubuntu/zeroclaw-migration-bundle/backend/src/channels/mod.rs`
   - Fixed empty skills handling to distinguish "no thread" from "thread with no skills"

## Next Steps

1. Test with actual Telegram messages
2. Verify bot responds with only thread-specific skills
3. Test edge cases (empty skills, no thread, etc.)
