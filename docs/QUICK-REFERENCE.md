# Quick Reference - ZeroClaw

**Szybki przewodnik** | **Last Update**: 2026-03-13 14:00
**Poziom**: 🚀 **Full Autonomy** - Pełne moce programistyczne

---

## ⚡ Current Status
```
✅ ZeroClaw Running - Full Autonomy
✅ All Commands Allowed
✅ Full File System Access (/)
✅ 16 Model Routes Configured
✅ Open Skills Enabled (23 skills)
```

### ZeroClaw
```bash
# Status
pgrep -a zeroclaw

# Start
source ~/.zeroclaw/.env && ~/.cargo/bin/zeroclaw channel start &

# Restart
pkill -9 zeroclaw && ~/.cargo/bin/zeroclaw channel start &

# Logi
tail -f ~/.zeroclaw/logs/channel-new.log
```

### Testy
```bash
# Szybki test
bash /home/ubuntu/playwright-test/quick-test.sh

# Pełny test
cd /home/ubuntu/playwright-test && node session-test.js

# Monitor routing
bash /home/ubuntu/playwright-test/monitor-routing.sh
```

### Ollama
```bash
# Status
curl http://127.0.0.1:11434/api/tags

# Lista modeli
ollama list
```

---

## 📂 Kluczowe Ścieżki

| Co | Gdzie |
|----|-------|
| **Knowledge Base** | `/home/ubuntu/KNOWLEDGE-BASE.md` |
| **Config ZeroClaw** | `~/.zeroclaw/config.toml` |
| **API Keys** | `~/.zeroclaw/.env` |
| **Źródła** | `/home/ubuntu/zeroclaw-migration-bundle/` |
| **Testy** | `/home/ubuntu/playwright-test/` |
| **Logi** | `~/.zeroclaw/logs/channel-new.log` |
| **Sesja TG** | `/home/ubuntu/playwright-test/telegram-session.json` |

---

## 🔄 Model Routing (16 tras)

```
premium/review     → glm-4.7 (ZAI coding)
coding/code/default/quick → glm-4.5 (ZAI coding)
vision             → glm-4.5v (ZAI coding)
complex/deep/architect → glm-5 (ZAI standard)
nvidia             → llama-3.3-70b (NVIDIA)
mistral            → codestral (Mistral)
openrouter         → claude-sonnet-4 (OpenRouter)
local/fast/cheap   → qwen2.5-coder:7b (Ollama)
```

**Test**: Wyślij do @karndt_bot: `hint:wiadomość`

---

## 📊 Status

```
✅ ZeroClaw      - Running (glm-4.7)
✅ Ollama        - Running (qwen2.5-coder:7b)
✅ Z.AI Coding   - Active
✅ Telegram      - @karndt_bot ready
✅ 16 routes     - Configured
```

---

**Pełna dokumentacja**: `/home/ubuntu/KNOWLEDGE-BASE.md`
