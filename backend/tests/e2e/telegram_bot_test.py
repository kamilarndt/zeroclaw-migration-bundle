"""
ZeroClaw Telegram Bot E2E Tests - Pytest

Basic webhook test for Telegram integration.

Prerequisites:
- ZeroClaw daemon running with Telegram channel configured
- Webhook endpoint: http://localhost:42617/v1/channels/telegram/webhook
- TEST_TELEGRAM_SECRET: Webhook secret token for authentication

Environment variables:
- ZEROCLAW_WEBHOOK: Webhook base URL (default: http://localhost:42617)
- TEST_TELEGRAM_SECRET: Webhook secret token for authentication
- TEST_USER_ID: Telegram user ID for testing (default: 999123)
"""

import os
import httpx
import pytest
import time

# Configuration
ZEROCLAW_WEBHOOK = "http://localhost:42617/v1/channels/telegram/webhook"
TEST_USER_ID = int(os.getenv("TEST_USER_ID", "999123"))
REQUEST_TIMEOUT = 15  # seconds


class TelegramClient:
    """Helper client for simulating Telegram webhook requests."""

    def __init__(self, base_url: str, secret: str | None = None):
        self.base_url = base_url
        self.secret = secret
        self.client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

    async def send_message(
        self,
        text: str,
        user_id: int | None = None,
        chat_id: int | None = None
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
            self.base_url,
            json=payload,
            headers=headers
        )
        return response

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


@pytest.fixture
async def client():
    """Create a Telegram webhook client."""
    secret = os.getenv("TEST_TELEGRAM_SECRET")
    client = TelegramClient(ZEROCLAW_WEBHOOK, secret)
    yield client
    await client.close()


@pytest.mark.asyncio
async def test_webhook_accepts_message(client: TelegramClient):
    """Test that the webhook accepts a message and returns 200."""
    response = await client.send_message("Hello, ZeroClaw!")
    assert response.status_code == 200, "Webhook should accept the message"


@pytest.mark.asyncio
async def test_webhook_returns_quickly(client: TelegramClient):
    """Test that webhook returns quickly (async processing in background)."""
    import time
    long_message = "Generate a comprehensive plan for a distributed system. " * 10

    start_time = time.time()
    response = await client.send_message(long_message)
    elapsed = time.time() - start_time

    assert response.status_code == 200, "Webhook should return 200"
    assert elapsed < 3, f"Webhook returned in {elapsed}s, should be <3s"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
