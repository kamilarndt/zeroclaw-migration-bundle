# 📡 TRIAD SETUP GUIDE - ZeroClaw v0.4.0
## Channel Triad: CLI + Discord + Telegram

---

## 🎮 DISCORD - Command & Control

### Krok 1: Discord Developer Portal
1. Przejdź do https://discord.com/developers/applications
2. Kliknij "New Application"
3. Nazwa: `ZeroClaw` lub własna

### Krok 2: Bot Setup
1. W menu: Bot → Add Bot
2. Wygeneruj i SKOPIUJ TOKEN (widoczny tylko raz!)
3. Włącz INTENTS (KRYTYCZNE!):
   - ✅ PRESENCE INTENT
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT ← TO JEST NAJWAŻNIEJSZE!

### Krok 3: OAuth2 URL
1. OAuth2 → URL Generator
2. Scopes: ✅ bot ✅ applications.commands
3. Permissions:
   - Send Messages
   - Read Message History
   - View Channel
   - Manage Messages (opcjonalnie)
4. Skopiuj wygenerowany URL
5. Otwórz w przeglądarce i dodaj bota do serwera

---

## 📱 TELEGRAM - Walkie-Talkie

### Krok 1: BotFather
1. Otwórz Telegram i wyszukaj @BotFather
2. Wyślij: /newbot
3. Podaj nazwę: ZeroClaw
4. Podaj username: TwojBot_bot
5. SKOPIUJ API TOKEN

### Krok 2: Privacy Mode (KRYTYCZNE dla grup!)
1. Wyślij do @BotFather: /mybots
2. Wybierz swojego bota
3. Bot Settings → Group Privacy
4. Wybierz: DISABLE
5. Potwierdź

Bez tego bot będzie widział tylko:
- Komendy zaczynające się od /
- Wiadomości gdzie bot jest @mentioned
- Odpowiedzi na wiadomości bota

### Krok 3: Dodaj do grupy
1. Wyszukaj bota po username
2. Dodaj do grupy jako administrator

---

## 🔧 KONFIGURACJA ZEROKCLAW

### Opcja A: Plik .env
```bash
# /home/ubuntu/.zeroclaw/.env lub backend/.env
DISCORD_TOKEN=MTk4NjIyNDgzNDc...
TELEGRAM_BOT_TOKEN=7902674912:AAF...
```

### Opcja B: Zmienne środowiskowe
```bash
export DISCORD_TOKEN="MTk4NjIyNDgzNDc..."
export TELEGRAM_BOT_TOKEN="7902674912:AAF..."
```

### Opcja C: config.toml
```toml
[channels_config.discord]
bot_token = "MTk4NjIyNDgzNDc..."
allowed_users = ["*"]

[channels_config.telegram]
bot_token = "7902674912:AAF..."
allowed_users = ["*"]
stream_mode = "on"
```

---

## ✅ WERYFIKACJA

### Discord
```bash
# Włącz ZeroClaw z Discord
zeroclawlabs daemon

# Na serwerze Discord wyślij:
!ping
# lub po prostu:
hello zeroclaw
```

### Telegram
```bash
# W prywatnym czacie z botem:
/start
/ping

# W grupie (privacy disabled):
zeroclaw ping
```

---

## 🔒 BEZPIECZEŃSTWO

- NIGDY nie commituj tokenów do git
- Używaj .gitignore dla .env
- Ogranicz allowed_users do konkretnych nicków
- Regularnie regeneruj tokeny

---

*ZeroClaw v0.4.0 - Zero-Bloat Architecture*
*Channel Triad: CLI + Discord (C&C) + Telegram (Walkie-Talkie)*
