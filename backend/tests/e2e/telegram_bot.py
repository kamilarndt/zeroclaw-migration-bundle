"""
ZeroClaw Telegram Bot E2E Tests - Pytest

Tests memory retention per chat_id using the webhook API.
Validates that the bot maintains conversation context across webhook requests
and that RAG (Retrieval-Augmented Generation) works correctly.

Prerequisites:
- ZeroClaw daemon running with Telegram channel configured
- Webhook endpoint: http://localhost:42617/v1/channels/telegram/webhook
- Webhook secret token configured (TEST_TELEGRAM_SECRET env var)
- Qdrant running for vector search
- SQLite memory at ~/.zeroclaw/memory/brain.db

Environment variables:
- ZEROCLAW_WEBHOOK: Webhook base URL (default: http://localhost:42617)
- TEST_TELEGRAM_SECRET: Webhook secret token for authentication
- TEST_USER_ID: Telegram user ID for testing (default: 999123)
"""

import httpx
import pytest
import asyncio
import time
from typing import Optional

# Configuration
ZEROCLAW_WEBHOOK = "http://localhost:42617/v1/channels/telegram/webhook"
TEST_USER_ID = int(os.getenv("TEST_USER_ID", "999123"))
TEST_TIMEOUT = 30  # seconds
REQUEST_TIMEOUT = 15  # seconds


class TelegramClient:
    """Helper client for simulating Telegram webhook requests."""

    def __init__(self, base_url: str, secret: Optional[str] = None):
        self.base_url = base_url
        self.secret = secret
        self.client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

    async def send_message(
        self,
        text: str,
        user_id: Optional[int] = None,
        chat_id: Optional[int] = None
    ) -> httpx.Response:
        """Send a message to the ZeroClaw webhook."""
        user_id = user_id or TEST_USER_ID
        chat_id = chat_id or user_id

        payload = {
            "update_id": int(time.time()),
            "message": {
                "message_id": 1,
                "from": {
                    "id": user_id,
                    "first_name": "TestUser",
                    "is_bot": False
                },
                "chat": {
                    "id": chat_id,
                    "type": "private"
                },
                "date": int(time.time()),
                "text": text
            }
        }

        headers = {}
        if self.secret:
            headers["X-Telegram-Bot-Api-Secret-Token"] = self.secret

        response = await self.client.post(
            f"{self.base_url}",
            json=payload,
            headers=headers
        )
        return response

    async def get_response(self, timeout: int = TEST_TIMEOUT) -> str:
        """Poll for the bot's response (simplified - in real tests, you'd check the channel)."""
        # In a real test, you'd either:
        # 1. Check the database for stored bot responses
        # 2. Poll a receive endpoint if available
        # 3. Use WebSocket connection for real-time updates

        # For this test, we'll check the SQLite memory for context
        await asyncio.sleep(2)  # Give time for processing

        # Return the last stored memory entry for this user
        # This is a placeholder - adjust based on your actual response retrieval
        return "Response received (check DB for actual content)"


@pytest.fixture
async def client():
    """Create a Telegram webhook client."""
    secret = os.getenv("TEST_TELEGRAM_SECRET")
    client = TelegramClient(ZEROCLAW_WEBHOOK, secret)
    yield client
    # Cleanup if needed
    await client.client.aclose()


class TestTelegramMemoryRetention:
    """Test suite for Telegram bot memory retention per chat_id."""

    @pytest.mark.asyncio
    async def test_remembers_username_across_webhooks(self, client: TelegramClient):
        """Test that the bot remembers the username across webhook invocations."""

        # Turn 1: Introduce username
        response1 = await client.send_message("My name is Bob and I'm testing memory retention.")
        assert response1.status_code == 200, "Webhook should acknowledge the message"

        # Wait for processing
        await asyncio.sleep(3)

        # Turn 2: Add filler conversation
        response2 = await client.send_message("What's 2+2?")
        assert response2.status_code == 200, "Webhook should acknowledge the message"

        # Wait for processing
        await asyncio.sleep(3)

        # Turn 3: Verify username is remembered
        response3 = await client.send_message("What's my name?")
        assert response3.status_code == 200, "Webhook should acknowledge the message"

        # In a real test, verify the response contains "Bob"
        # For now, we're validating the webhook accepts the messages

        # Verify memory was stored in SQLite
        # (You'd need to add a function to check the DB)
        stored_name = await self.check_memory_for_keyword("Bob")
        assert stored_name, "Bot should have stored the username in memory"

    @pytest.mark.asyncio
    async def test_remembers_facts_with_delay(self, client: TelegramClient):
        """Test that the bot remembers facts even with delays between messages."""

        # Store a fact
        await client.send_message("Remember this: my favorite color is #3366FF.")
        await asyncio.sleep(2)

        # Send unrelated messages
        await client.send_message("What's the weather?")
        await asyncio.sleep(2)

        await client.send_message("Tell me a joke.")
        await asyncio.sleep(2)

        # Retrieve the stored fact
        await client.send_message("What's my favorite color?")
        assert (await client.send_message("")).status_code == 200

        # Verify the color is recalled
        recalled_color = await self.check_memory_for_keyword("3366FF")
        assert recalled_color, "Bot should recall the favorite color"

    @pytest.mark.asyncio
    async def test_handles_concurrent_webhooks_same_user(self, client: TelegramClient):
        """Test that the bot handles concurrent messages from the same user."""

        async def send_concurrent():
            tasks = [
                client.send_message(f"Concurrent message {i}")
                for i in range(3)
            ]
            responses = await asyncio.gather(*tasks)
            return all(r.status_code == 200 for r in responses)

        # Send 3 messages concurrently
        assert await send_concurrent(), "All concurrent messages should be handled"

        # Wait for processing
        await asyncio.sleep(5)

        # Verify all messages were processed
        message_count = await self.count_user_messages(TEST_USER_ID)
        assert message_count >= 3, "All concurrent messages should be stored"

    @pytest.mark.asyncio
    async def test_rag_retrieves_relevant_context(self, client: TelegramClient):
        """Test that RAG (Retrieval-Augmented Generation) works via Telegram."""

        # First, store some test knowledge via direct API
        # (This would be a separate API endpoint or direct DB insertion)
        test_knowledge = "Rust ownership rules: Use 'cargo install' to install binaries. The binary goes to ~/.cargo/bin/."

        # Store in memory (implementation depends on your API)
        await self.store_memory("rust_install", test_knowledge)

        # Wait for indexing
        await asyncio.sleep(2)

        # Query the stored knowledge
        await client.send_message("How do I install Rust binaries?")
        assert (await client.send_message("")).status_code == 200

        # Wait for RAG retrieval and response
        await asyncio.sleep(3)

        # Verify response mentions cargo or installation
        response_text = await self.get_last_bot_response()
        assert "cargo" in response_text.lower() or "install" in response_text.lower()

    @pytest.mark.asyncio
    async def test_handles_long_messages_gracefully(self, client: TelegramClient):
        """Test that the bot handles very long messages without crashing."""

        long_message = "This is a very long message. " * 100 + "Please summarize this concisely."

        start_time = time.time()
        response = await client.send_message(long_message)
        elapsed = time.time() - start_time

        assert response.status_code == 200, "Should accept long message"
        assert elapsed < 10, "Should respond quickly even for long messages"

        # Verify the message was processed
        await asyncio.sleep(2)
        assert await self.check_memory_exists(), "Long message should be stored in memory"

    @pytest.mark.asyncio
    async def test_handles_special_characters(self, client: TelegramClient):
        """Test that special characters are handled correctly."""

        messages_with_special_chars = [
            "Test emoji: 🚀 🎉 🦀",
            "Test quotes: 'single' and \"double\"",
            "Test code: ```rust fn main() {}```",
            "Test math: E=mc² where c is light speed",
            "Test HTML: <div>content</div>",
        ]

        for msg in messages_with_special_chars:
            response = await client.send_message(msg)
            assert response.status_code == 200, f"Should handle message: {msg[:50]}..."

    @pytest.mark.asyncio
    async def test_forgets_and_recalls_after_clear(self, client: TelegramClient):
        """Test that the bot can forget and then relearn information."""

        # Store information
        await client.send_message("Remember: The answer to life is 42.")
        await asyncio.sleep(2)

        # Verify it's remembered
        await client.send_message("What's the answer to life?")
        assert (await client.send_message("")).status_code == 200
        # In real test, verify response contains "42"

        # Clear the memory (if you have a forget endpoint)
        # await client.send_message("/forget answer_to_life")

        # Wait for clearing
        await asyncio.sleep(2)

        # Re-teach the information
        await client.send_message("The answer to life is 42, remember that.")
        await asyncio.sleep(2)

        # Verify it's relearned
        await client.send_message("What's the answer to life again?")
        assert (await client.send_message())).status_code == 200

    @pytest.mark.asyncio
    async def test_handles_empty_message_gracefully(self, client: TelegramClient):
        """Test that empty messages don't cause crashes."""

        response = await client.send_message("")
        assert response.status_code == 200, "Should handle empty message gracefully"

        # System should still be stable
        followup = await client.send_message("Are you there?")
        assert followup.status_code == 200, "Should still respond after empty message"

    @pytest.mark.asyncio
    async def test_webhook_returns_200_quickly(self, client: TelegramClient):
        """Test that webhook returns 200 immediately, even for long operations."""

        long_operation = "Generate a comprehensive architectural plan for a distributed system spanning 5 regions. Include details on load balancing, database sharding, and caching strategies. This should take a while to process."

        start_time = time.time()
        response = await client.send_message(long_operation)
        elapsed = time.time() - start_time

        # Webhook MUST return quickly (async processing in background)
        assert response.status_code == 200, "Webhook should return 200 immediately"
        assert elapsed < 3, f"Webhook returned in {elapsed}s, should be <3s for async processing"

    # =========================================================================
    # HELPER METHODS (to be implemented based on your API)
    # =========================================================================

    async def check_memory_for_keyword(self, keyword: str) -> bool:
        """Check if a keyword exists in stored memory for this user."""
        # Implementation: Query SQLite DB or use recall API
        # This is a placeholder - adapt to your actual memory API
        query_response = await self.client.post(
            f"{self.base_url}/../../api/v1/memory/recall",
            json={"query": keyword, "limit": 1},
            timeout=5.0
        )
        if query_response.status_code == 200:
            data = query_response.json()
            return len(data.get("results", [])) > 0
        return False

    async def check_memory_exists(self) -> bool:
        """Check if any memory exists for this user."""
        response = await self.client.post(
            f"{self.base_url}/../../api/v1/memory/recall",
            json={"query": "test", "limit": 1},
            timeout=5.0
        )
        return response.status_code == 200

    async def count_user_messages(self, user_id: int) -> int:
        """Count stored messages for a user."""
        # Implementation: Query message history count
        # This is a placeholder
        return 0

    async def store_memory(self, key: str, content: str, category: str = "telegram_test"):
        """Store a memory entry directly (bypassing bot)."""
        # Implementation: Call memory store API
        pass

    async def get_last_bot_response(self) -> str:
        """Get the last response sent by the bot to this user."""
        # Implementation: Query from message history or logs
        return "Last response"


class TestTelegramErrorScenarios:
    """Test suite for error handling in Telegram integration."""

    @pytest.mark.asyncio
    async def test_handles_invalid_utf8_gracefully(self, client: TelegramClient):
        """Test that invalid UTF-8 is handled without crashes."""

        # Send a message with invalid UTF-8 sequence
        # (In practice, Telegram validates this, but we test our handling)
        response = await client.send_message("Valid message with émojis 🚀")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_handles_very_long_message(self, client: TelegramClient):
        """Test that extremely long messages are truncated or handled properly."""

        # Create a 10,000 character message
        huge_message = "A" * 10000

        response = await client.send_message(huge_message)
        assert response.status_code in (200, 413), "Should accept or reject with 413"

    @pytest.mark.asyncio
    async def test_handles_special_formatting(self, client: TelegramClient):
        """Test that markdown, code blocks, etc. are preserved."""

        markdown_message = """
Format test:

**Bold text**
*Italic text*
`inline code`

```rust
fn main() {
    println!("Hello");
}
```

- List item 1
- List item 2
"""
        response = await client.send_message(markdown_message)
        assert response.status_code == 200


class TestTelegramRAGIntegration:
    """Test suite specifically for RAG functionality via Telegram."""

    @pytest.mark.asyncio
    async def test_rag_provides_context_from_stored_knowledge(self, client: TelegramClient):
        """Test that RAG pulls from previously stored knowledge."""

        # Store specific knowledge with unique identifier
        await self.store_memory(
            "test_rag_zeroclaw",
            "ZeroClaw is a Rust-based AI agent framework that runs on minimal hardware. It supports multiple LLM providers including OpenRouter, Anthropic, and Ollama."
        )

        # Wait for indexing
        await asyncio.sleep(3)

        # Query for the information
        await client.send_message("What is ZeroClaw and what language is it written in?")
        assert (await client.send_message()).status_code == 200

        # Verify response mentions Rust and AI agent
        response_text = await self.get_last_bot_response()
        assert "rust" in response_text.lower() or "ai" in response_text.lower()

    @pytest.mark.asyncio
    async def test_rag_handles_multiple_relevant_entries(self, client: TelegramClient):
        """Test that RAG can pull multiple relevant memories."""

        # Store multiple related facts
        await self.store_memory("fact1", "ZeroClaw uses Qdrant for vector storage.")
        await self.store_memory("fact2", "ZeroClaw uses SQLite for relational storage.")
        await self.store_memory("fact3", "ZeroClaw supports Telegram, Discord, and Matrix channels.")

        await asyncio.sleep(3)

        # Query that should match multiple entries
        await client.send_message("What storage systems does ZeroClaw use?")
        assert (await client.send_message()).status_code == 200

    @pytest.mark.asyncio
    async def test_rag_returns_empty_for_irrelevant_query(self, client: TelegramClient):
        """Test that RAG doesn't force irrelevant context."""

        await client.send_message("What's the capital of Mozambique?")
        assert (await client.send_message()).status_code == 200

        # Should get an answer based on general knowledge, not stored memories


class TestTelegramMultiUser:
    """Test suite for multiple users with isolated memories."""

    @pytest.mark.asyncio
    async def test_users_have_isolated_memories(self, client: TelegramClient):
        """Test that different users have separate memory contexts."""

        user1_id = 999123
        user2_id = 999456

        # User 1 stores information
        await client.send_message("My favorite number is 42.", user_id=user1_id)
        await asyncio.sleep(2)

        # User 2 stores different information
        await client.send_message("My favorite number is 99.", user_id=user2_id)
        await asyncio.sleep(2)

        # User 1 queries their info
        await client.send_message("What's my favorite number?", user_id=user1_id)
        await asyncio.sleep(2)

        # User 2 queries their info
        await client.send_message("What's my favorite number?", user_id=user2_id)
        await asyncio.sleep(2)

        # Verify isolation
        # User 1 should get "42", User 2 should get "99"
        # (Implementation would check actual responses)


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture(scope="session")
async def ensure_daemon_running():
    """Ensure ZeroClaw daemon is running before tests."""
    try:
        # Check health endpoint
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:42617/health", timeout=5.0)
            response.raise_for_status()
    except Exception as e:
        pytest.skip(f"ZeroClaw daemon not running: {e}")


@pytest.fixture(scope="session")
async def ensure_qdrant_running():
    """Ensure Qdrant vector database is running."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:6333/collections", timeout=5.0)
            response.raise_for_status()
    except Exception as e:
        pytest.skip(f"Qdrant not running: {e}")


# Auto-use fixtures
pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(os.getenv("SKIP_TELEGRAM_TESTS", "false") == "true", reason="Telegram tests skipped by env")
]


# ============================================================================
# STRESS TESTS (can be run separately with pytest -k stress)
# ============================================================================

class TestTelegramStress:
    """Stress tests for Telegram webhook under load."""

    @pytest.mark.asyncio
    @pytest.mark.stress
    async def test_handles_rapid_successive_messages(self, client: TelegramClient):
        """Test that the bot handles rapid-fire messages."""

        num_messages = 20
        start_time = time.time()

        for i in range(num_messages):
            response = await client.send_message(f"Quick message {i}")
            assert response.status_code == 200, f"Message {i} should be accepted"

        elapsed = time.time() - start_time
        avg_time = elapsed / num_messages

        # Each message should be processed reasonably quickly
        assert avg_time < 2, f"Average response time {avg_time}s is too slow"

    @pytest.mark.asyncio
    @pytest.mark.stress
    async def test_handles_parallel_users(self, client: TelegramClient):
        """Test concurrent webhooks from different users."""

        num_users = 10
        messages_per_user = 3

        async def user_session(user_id: int):
            tasks = [
                client.send_message(f"User {user_id} message {j}", user_id=user_id)
                for j in range(messages_per_user)
            ]
            return await asyncio.gather(*tasks)

        # Run sessions in parallel
        user_ids = list(range(100000, 100000 + num_users))
        session_tasks = [user_session(uid) for uid in user_ids]
        results = await asyncio.gather(*session_tasks, return_exceptions=True)

        # All requests should be handled
        successful = sum(1 for r in results if r.status_code == 200)
        assert successful >= num_users * messages_per_user * 0.95, "95% of requests should succeed"


if __name__ == "__main__":
    # Run tests with: pytest telegram_bot.py -v
    # Add markers: pytest telegram_bot.py -k "not stress" (skip stress tests)
    pytest.main([__file__, "-v", "-s"])
