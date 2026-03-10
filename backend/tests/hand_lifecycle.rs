//! Integration tests for hand lifecycle with isolation and interruption.
//!
//! These tests verify the complete lifecycle of hands including:
//! - Workspace creation and cleanup
//! - File isolation between concurrent hands
//! - Process group interruption
//!
//! Ref: Task 19: Integration Testing

use std::fs;
use std::path::PathBuf;
use zeroclaw::agent::hands::HandsDispatcher;
use zeroclaw::agent::interruption::InterruptionHandler;

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Hand lifecycle with isolation
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_hand_lifecycle_isolation() {
    // Create temporary base directory for testing
    let temp_dir = tempfile::TempDir::new().unwrap();
    let base_dir = temp_dir.path().to_str().unwrap();

    let dispatcher = HandsDispatcher {
        base_dir: base_dir.to_string(),
        hands_semaphore: std::sync::Arc::new(tokio::sync::Semaphore::new(5)),
        active_hands: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
    };

    let hand_id = "test-hand-lifecycle";

    // Step 1: Register hand - verify workspace exists
    let workspace_path = dispatcher.register_hand(hand_id.to_string()).await.unwrap();

    // Verify workspace was created
    assert!(workspace_path.exists(), "Workspace directory should exist after registration");
    assert!(workspace_path.is_dir(), "Workspace should be a directory");

    // Verify workspace path structure
    let expected_path = PathBuf::from(base_dir)
        .join("hands")
        .join(hand_id);
    assert_eq!(workspace_path, expected_path, "Workspace path should match expected structure");

    // Verify hand state is tracked
    assert!(dispatcher.is_active(hand_id).await, "Hand should be marked as active");
    assert_eq!(dispatcher.active_count().await, 1, "Should have exactly 1 active hand");

    // Verify hand state contains workspace path
    let hands = dispatcher.active_hands.read().await;
    let hand_state = hands.get(hand_id).unwrap();
    assert_eq!(hand_state.workspace_path, Some(workspace_path.clone()), "Hand state should contain workspace path");
    drop(hands);

    // Step 2: Unregister hand - verify cleanup
    dispatcher.unregister_hand(hand_id).await.unwrap();

    // Verify workspace was removed
    assert!(!workspace_path.exists(), "Workspace directory should be removed after unregistration");

    // Verify hand state was removed
    assert!(!dispatcher.is_active(hand_id).await, "Hand should not be active after unregistration");
    assert_eq!(dispatcher.active_count().await, 0, "Should have 0 active hands after unregistration");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Concurrent hands isolation
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_concurrent_hands_isolation() {
    // Create temporary base directory for testing
    let temp_dir = tempfile::TempDir::new().unwrap();
    let base_dir = temp_dir.path().to_str().unwrap();

    let dispatcher = HandsDispatcher {
        base_dir: base_dir.to_string(),
        hands_semaphore: std::sync::Arc::new(tokio::sync::Semaphore::new(10)),
        active_hands: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
    };

    let hand1_id = "concurrent-hand-1";
    let hand2_id = "concurrent-hand-2";

    // Register two concurrent hands
    let workspace1 = dispatcher.register_hand(hand1_id.to_string()).await.unwrap();
    let workspace2 = dispatcher.register_hand(hand2_id.to_string()).await.unwrap();

    // Verify both workspaces exist and are distinct
    assert!(workspace1.exists(), "Hand 1 workspace should exist");
    assert!(workspace2.exists(), "Hand 2 workspace should exist");
    assert_ne!(workspace1, workspace2, "Workspaces should be different directories");

    // Verify both hands are active
    assert!(dispatcher.is_active(hand1_id).await, "Hand 1 should be active");
    assert!(dispatcher.is_active(hand2_id).await, "Hand 2 should be active");
    assert_eq!(dispatcher.active_count().await, 2, "Should have 2 active hands");

    // Write different files to each workspace
    let file1 = workspace1.join("test.txt");
    let file2 = workspace2.join("test.txt");

    fs::write(&file1, "content from hand 1").unwrap();
    fs::write(&file2, "content from hand 2").unwrap();

    // Verify file isolation - each hand should only see its own files
    let content1 = fs::read_to_string(&file1).unwrap();
    let content2 = fs::read_to_string(&file2).unwrap();

    assert_eq!(content1, "content from hand 1", "Hand 1 should see its own content");
    assert_eq!(content2, "content from hand 2", "Hand 2 should see its own content");
    assert_ne!(content1, content2, "Content should be isolated between hands");

    // Verify hand 2 cannot see hand 1's files
    let hand1_files = fs::read_dir(&workspace1).unwrap();
    let hand2_files = fs::read_dir(&workspace2).unwrap();

    assert_eq!(hand1_files.count(), 1, "Hand 1 workspace should have exactly 1 file");
    assert_eq!(hand2_files.count(), 1, "Hand 2 workspace should have exactly 1 file");

    // Unregister hands and verify isolation during cleanup
    dispatcher.unregister_hand(hand1_id).await.unwrap();

    // Hand 1 workspace should be gone, hand 2 should remain
    assert!(!workspace1.exists(), "Hand 1 workspace should be removed");
    assert!(workspace2.exists(), "Hand 2 workspace should still exist");
    assert!(file2.exists(), "Hand 2 files should still exist");

    // Clean up hand 2
    dispatcher.unregister_hand(hand2_id).await.unwrap();
    assert!(!workspace2.exists(), "Hand 2 workspace should be removed");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Interruption with process group killing
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_interruption_process_group_killing() {
    // Create temporary base directory for testing
    let temp_dir = tempfile::TempDir::new().unwrap();
    let base_dir = temp_dir.path().to_str().unwrap();

    let dispatcher = HandsDispatcher {
        base_dir: base_dir.to_string(),
        hands_semaphore: std::sync::Arc::new(tokio::sync::Semaphore::new(5)),
        active_hands: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
    };

    let hand_id = "test-interruption-hand";

    // Register a hand
    dispatcher.register_hand(hand_id.to_string()).await.unwrap();

    // Set a fake PGID (non-existent process group)
    let fake_pgid = 99999u32;
    dispatcher.set_hand_pgid(hand_id, fake_pgid).await.unwrap();

    // Verify PGID was set
    let hands = dispatcher.active_hands.read().await;
    let hand_state = hands.get(hand_id).unwrap();
    assert_eq!(hand_state.pgid, Some(fake_pgid), "PGID should be set");
    drop(hands);

    // Test interruption with process group killing
    // This will attempt to kill the non-existent process group
    // The InterruptionHandler::kill_process_group handles ESRCH gracefully
    let result = dispatcher.interrupt_hand_killed(hand_id).await;

    // Should succeed even though the process group doesn't exist (ESRCH is OK)
    assert!(result.is_ok(), "interruption should succeed even with non-existent PGID");

    // Verify the cancellation token was cancelled
    let hands = dispatcher.active_hands.read().await;
    let hand_state = hands.get(hand_id).unwrap();
    assert!(hand_state.token.is_cancelled(), "Cancellation token should be cancelled");
    drop(hands);

    // Clean up
    dispatcher.unregister_hand(hand_id).await.unwrap();
}

#[tokio::test]
async fn test_interruption_handler_esrch_handling() {
    // Test that InterruptionHandler::kill_process_group handles ESRCH correctly

    // Try to kill a non-existent process group
    let fake_pgid = 88888u32;
    let result = InterruptionHandler::kill_process_group(fake_pgid);

    // Should return Ok() because ESRCH is treated as success
    assert!(result.is_ok(), "kill_process_group should handle ESRCH gracefully");
}

#[tokio::test]
async fn test_interruption_nonexistent_hand() {
    // Create temporary base directory for testing
    let temp_dir = tempfile::TempDir::new().unwrap();
    let base_dir = temp_dir.path().to_str().unwrap();

    let dispatcher = HandsDispatcher {
        base_dir: base_dir.to_string(),
        hands_semaphore: std::sync::Arc::new(tokio::sync::Semaphore::new(5)),
        active_hands: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
    };

    // Try to interrupt a non-existent hand
    let result = dispatcher.interrupt_hand_killed("nonexistent-hand").await;

    // Should succeed (idempotent)
    assert!(result.is_ok(), "interrupting non-existent hand should succeed");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Workspace creation and file isolation verification
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_workspace_file_operations() {
    // Create temporary base directory for testing
    let temp_dir = tempfile::TempDir::new().unwrap();
    let base_dir = temp_dir.path().to_str().unwrap();

    let dispatcher = HandsDispatcher {
        base_dir: base_dir.to_string(),
        hands_semaphore: std::sync::Arc::new(tokio::sync::Semaphore::new(5)),
        active_hands: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
    };

    let hand_id = "test-file-ops-hand";

    // Register hand and get workspace
    let workspace = dispatcher.register_hand(hand_id.to_string()).await.unwrap();

    // Test file creation
    let test_file = workspace.join("test_file.txt");
    fs::write(&test_file, "test content").unwrap();
    assert!(test_file.exists(), "File should be created in workspace");

    // Test directory creation
    let test_dir = workspace.join("subdir");
    fs::create_dir(&test_dir).unwrap();
    assert!(test_dir.exists(), "Directory should be created in workspace");
    assert!(test_dir.is_dir(), "Should be a directory");

    // Test nested directory creation
    let nested_dir = workspace.join("level1").join("level2").join("level3");
    fs::create_dir_all(&nested_dir).unwrap();
    assert!(nested_dir.exists(), "Nested directories should be created");

    // Verify files are isolated to this workspace
    let hands_dir = workspace.parent().unwrap(); // Should be .../hands/
    let parent_contents = fs::read_dir(hands_dir).unwrap();
    let hand_dirs: Vec<_> = parent_contents.filter_map(|e| e.ok()).collect();

    // Should only have our hand directory
    assert_eq!(hand_dirs.len(), 1, "Should have exactly 1 hand directory");
    assert_eq!(hand_dirs[0].file_name().to_string_lossy(), hand_id, "Directory name should match hand_id");

    // Clean up
    dispatcher.unregister_hand(hand_id).await.unwrap();

    // Verify all files and directories are cleaned up
    assert!(!workspace.exists(), "Workspace should be completely removed");
    assert!(!test_file.exists(), "Files should be removed");
    assert!(!test_dir.exists(), "Directories should be removed");
    assert!(!nested_dir.exists(), "Nested directories should be removed");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5: Hand state management
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_hand_state_management() {
    let temp_dir = tempfile::TempDir::new().unwrap();
    let base_dir = temp_dir.path().to_str().unwrap();

    let dispatcher = HandsDispatcher {
        base_dir: base_dir.to_string(),
        hands_semaphore: std::sync::Arc::new(tokio::sync::Semaphore::new(5)),
        active_hands: std::sync::Arc::new(tokio::sync::RwLock::new(std::collections::HashMap::new())),
    };

    let hand_id = "test-state-hand";

    // Register hand
    let _workspace = dispatcher.register_hand(hand_id.to_string()).await.unwrap();

    // Set PGID
    dispatcher.set_hand_pgid(hand_id, 12345).await.unwrap();

    // Set custom workspace
    let custom_workspace = PathBuf::from("/tmp/custom/workspace");
    dispatcher.set_hand_workspace(hand_id, custom_workspace.clone()).await.unwrap();

    // Verify all state is set correctly
    let hands = dispatcher.active_hands.read().await;
    let hand_state = hands.get(hand_id).unwrap();

    assert_eq!(hand_state.pgid, Some(12345), "PGID should be set");
    assert_eq!(hand_state.workspace_path, Some(custom_workspace), "Custom workspace should be set");
    assert!(!hand_state.token.is_cancelled(), "Token should not be cancelled initially");
    drop(hands);

    // Test interruption cancels token
    dispatcher.interrupt_hand(hand_id).await.unwrap();

    let hands = dispatcher.active_hands.read().await;
    let hand_state = hands.get(hand_id).unwrap();
    assert!(hand_state.token.is_cancelled(), "Token should be cancelled after interruption");
    drop(hands);

    // Clean up
    dispatcher.unregister_hand(hand_id).await.unwrap();
}
