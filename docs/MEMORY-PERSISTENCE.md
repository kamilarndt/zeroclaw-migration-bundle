# ZeroClaw Memory Persistence System

**Data**: 2026-03-13 17:45 UTC
**Status**: ✅ Aktywny
**Wersja**: 1.0

---

## 🎯 Problem

ZeroClaw po restarcie nie pamiętał kontekstu konwersacji. Użytkownik musiał ponownie wyjaśniać kontekst.

**Przyczyna**: Runtime historia (self.history) jest tracona po restarcie.

---

## ✅ Rozwiązanie

System automatycznego backup i restore pamięci konwersacyjnej:

```
┌─────────────────────────────────────────────────┐
│  MEMORY PRESERVATION WORKFLOW                   │
├─────────────────────────────────────────────────┤
│                                                   │
│  1. USER MESSAGE arrives                          │
│     ↓                                              │
│  2. STORED to conversation_history (DB)           │
│     ↓                                              │
│  3. RESTART NEEDED                                │
│     ↓                                              │
│  4. BACKUP SCRIPT runs:                           │
│     - Dump conversation_history to JSON           │
│     - Save memories snapshot                      │
│     - Save config snapshot                        │
│     ↓                                              │
│  5. ZEROCLAW STOPPED                              │
│     ↓                                              │
│  6. ZEROCLAW STARTED                             │
│     ↓                                              │
│  7. RESTORE SCRIPT runs:                          │
│     - Load conversation_history from JSON          │
│     - Populate database table                      │
│     - Update conversation_history.json cache      │
│     ↓                                              │
│  8. CONTEXT LOADED via skill                     │
│     ↓                                              │
│  9. READY to respond with full context            │
│                                                   │
└─────────────────────────────────────────────────┘
```

---

## 📁 Pliki

### Skrypty
| Plik | Opis |
|------|------|
| `~/.zeroclaw/scripts/backup_memory.sh` | Backup pamięci PRZED restartem |
| `~/.zeroclaw/scripts/restore_memory.sh` | Restore pamięci PO restarcie |
| `~/.zeroclaw/scripts/restart_with_memory.sh` | **Główny skrypt** - pełny restart |
| `~/.zeroclaw/scripts/persist_history.py` | Python helper |

### Backup Location
| Plik | Opis |
|------|------|
| `~/.zeroclaw/workspace/memory_backups/` | Katalog z backupami |
| `memory_backup_YYYYMMDD_HHMMSS.json` | Pełny backup |
| `memory_backup_latest.json` | Symlink do najnowego |
| `config_YYYYMMDD_HHMMSS.toml` | Snapshot konfiguracji |

### Cache Files
| Plik | Opis |
|------|------|
| `~/.zeroclaw/workspace/conversation_history.json` | JSON cache dla skilli |

---

## 🗄️ Baza Danych

### conversation_history Tabela

```sql
CREATE TABLE conversation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,      -- "telegram"
    sender TEXT NOT NULL,        -- "Kamarndt"
    role TEXT NOT NULL,         -- "user" / "assistant"
    content TEXT NOT NULL,      -- treść wiadomości
    timestamp REAL NOT NULL,   -- unix timestamp
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

**Indexy**:
- `idx_conv_channel_sender` - szybkie wyszukiwanie po konwersacji
- `idx_conv_timestamp` - sortowanie po czasie

---

## 🚀 Użycie

### Automatyczny Restart (Zalecany)

```bash
bash ~/.zeroclaw/scripts/restart_with_memory.sh
```

**Output**:
```
🔄 ZeroClaw Restart WITH Memory Preservation
==========================================

📦 Step 1: Backing up memory...
  ✅ Saved 16 history entries

🛑 Step 2: Stopping ZeroClaw...
  ✅ Stopped

🚀 Step 3: Starting ZeroClaw...
  ✅ Started (PID: XXXX)

💾 Step 4: Restoring memory...
  ✅ Restored 16 messages to database
  ✅ Saved to JSON cache

✅ Step 5: Verifying...
  ✅ ZeroClaw running
  ✅ Conversation history loaded

🎉 Restart complete! Context preserved.
```

### Ręczne Backup

```bash
bash ~/.zeroclaw/scripts/backup_memory.sh
```

### Ręczne Restore

```bash
bash ~/.zeroclaw/scripts/restore_memory.sh
```

---

## 📊 Status

### Aktualna Konfiguracja

```toml
[memory]
backend = "qdrant"              # Vector database
auto_save = true               # Auto-zapis wiadomości

[memory.qdrant]
url = "http://localhost:6333"
collection = "zeroclaw_memories"
```

### Skills Odpowiedzialne

| Skill | Opis |
|-------|------|
| `memory-persistence` | Automatyczny backup/restore |
| `load-conversation-history` | Ładowanie historii dla kontekstu |

---

## 🔧 Troubleshooting

### Problem: Context nie przywrócony

**Rozwiązanie**:
```bash
# Sprawdź czy backup istnie
ls -lh ~/.zeroclaw/workspace/memory_backups/memory_backup_latest.json

# Ręcznie przywróć
bash ~/.zeroclaw/scripts/restore_memory.sh

# Sprawdź cache
cat ~/.zeroclaw/workspace/conversation_history.json | python3 -m json.tool
```

### Problem: Backup jest pusty

**Rozwiązanie**:
```bash
# Sprawdź tabelę conversation_history
python3 << 'EOF'
import sqlite3
conn = sqlite3.connect('~/.zeroclaw/workspace/memory/brain.db')
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM conversation_history")
print(f"Messages in DB: {cursor.fetchone()[0]}")
EOF
```

### Problem: Skill nie ładuje historii

**Rozwiązanie**:
```bash
# Odśwież cache
python3 ~/.zeroclaw/scripts/persist_history.py

# Sprawdź czy plik istnie i ma dane
cat ~/.zeroclaw/workspace/conversation_history.json
```

---

## 📝 Podsumowanie

✅ **Co działa**:
- Automatyczny backup przed restartem
- Automatyczne przywracanie po restarcie
- Kontekst konwersacji zachowany
- 16 wiadomości migrowanych
- Skrypty gotowe do użycia

✅ **Co dostępne**:
- 26 skills (w tym 2 nowe do pamięci)
- Qdrant vector database
- JSON cache dla szybkiego ładowania
- Symlink do najnowszego backupu

---

**Data**: 2026-03-13 17:45 UTC
**Wersja**: 1.0
**Status**: ✅ Produkcja
