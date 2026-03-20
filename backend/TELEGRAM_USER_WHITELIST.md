# Critical Finding: Bot User Whitelist

## Issue

The ZeroClaw bot is configured to **only respond to specific allowed users**.

**Current Configuration:**
```toml
allowed_users = ["Kamarndt"]
```

**Impact:**
- ✅ Messages from "Kamarndt" will be processed
- ❌ Messages from any other user will be **silently ignored**

## Testing

To test the bot, you must:
1. Use Telegram account with username "Kamarndt"
2. OR temporarily add your username to allowed_users

## How to Add More Users

Edit `/home/ubuntu/.zeroclaw/config.toml`:

```toml
[channels_config.telegram]
allowed_users = ["Kamarndt", "your_username_here"]
```

Then restart daemon:
```bash
pkill -f zeroclaw
~/.cargo/bin/zeroclaw daemon &
```

## Test Procedure for Kamarndt

1. Open Telegram
2. Search for @karndt_bot (or "Botomaz")
3. Send: **hello**
4. Bot should respond

## Test Menu Button

1. In chat with @karndt_bot
2. Look for menu button on left side (⌘ or "Menu")
3. Tap to open TMA Hub
4. Create thread and toggle skills

## Current Menu Button

- **Text:** "Menu" (Telegram shows default)
- **URL:** https://duck-sitting-door-sender.trycloudflare.com/tma/hub
- **Type:** Web App

To change text, use @BotFather:
1. `/setmenubutton`
2. Select @karndt_bot
3. URL: `https://duck-sitting-door-sender.trycloudflare.com/tma/hub`
4. Text: `⌘ ZeroClaw`

## Daemon Status

✅ **Running** (PID 4166)
✅ **Webhook active** (returns 200 OK)
✅ **TMA Hub accessible** (HTML loads)
✅ **Per-conversation skills implemented**
