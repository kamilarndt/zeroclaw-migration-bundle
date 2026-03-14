# 🛤️ TELEGRAM ZERO-BLOAT ROADMAP

## 📊 OGÓLNA OCENA IMPLEMENTACJI

| Komponent | Status | Priorytet | Szacowany czas |
|-----------|--------|-----------|----------------|
| **TMA Auth (verify_webapp_initdata)** | ✅ 100% | HIGH | 0h |
| **Webhook Support (setup_webhook)** | ✅ 80% | HIGH | 1h |
| **Baza Danych (migracja)** | ✅ 100% | HIGH | 0h |
| **Gateway REST API** | ✅ 70% | HIGH | 2h |
| **WebSocket Gateway** | ✅ 100% | HIGH | 0h |
| **Telegram REST API** | ❌ 0% | HIGH | 4h |
| **Frontend TMA** | ❌ 0% | HIGH | 4h |
| **Inline Keyboards** | ❌ 0% | MEDIUM | 2h |
| **Circuit Breaker** | ❌ 0% | MEDIUM | 2h |

**OGÓLNA GOTOWOŚĆ:** ~50%

---

## ✅ CO JUŻ ZROBIONE

### 1. **TMA Authentication**
**Zaimplementowane w:** `backend/src/channels/telegram.rs`

```rust
/// Telegram WebApp initData structure
pub struct TelegramWebAppInitData {
    pub query_id: Option<String>,
    pub user: Option<TelegramWebAppUser>,
    pub auth_date: i64,
    pub hash: String,
}

/// Telegram user from WebApp initData
pub struct TelegramWebAppUser {
    pub id: i64,
    pub first_name: String,
    pub username: Option<String>,
}

/// Verify Telegram WebApp initData for secure authentication
pub fn verify_webapp_initdata(&self, init_data: &str) -> anyhow::Result<TelegramWebAppInitData> {
    use std::collections::HashMap;
    use serde_urlencoded::from_str;
    use hmacsha256::HMAC;

    // Parse URL-encoded initData
    let params: HashMap<String, String> = from_str(init_data)
        .map_err(|e| anyhow::anyhow!("Failed to parse initData: {}", e))?;
    
    // Extract hash
    let hash = params.get("hash")
        .ok_or_else(|| anyhow::anyhow!("Missing hash parameter"))?;
    
    // Create data check string
    let data_check_string = Self::create_data_check_string(&params);
    
    // Verify HMAC-SHA256
    let secret_key = HMAC::mac(self.bot_token.as_bytes(), "WebAppData".as_bytes());
    let expected_hash = hex::encode(HMAC::mac(&secret_key, data_check_string.as_bytes()));
    
    if hash != &expected_hash {
        anyhow::bail!("Invalid initData signature");
    }
    
    // Verify auth_date (anti-replay, max 5 minutes old)
    if let Some(auth_date_str) = params.get("auth_date") {
        if let Ok(auth_timestamp) = auth_date_str.parse::<i64>() {
            use chrono::Utc;
            let current_time = Utc::now().timestamp();
            let max_age = 300; // 5 minutes
            
            if (current_time - auth_timestamp).abs() > max_age {
                anyhow::bail!("initData too old (replay attack protection)");
            }
        }
    }
    
    // Parse user
    let user_json = params.get("user")
        .ok_or_else(|| anyhow::anyhow!("Missing user parameter"))?;
    
    let user: TelegramWebAppUser = serde_json::from_str(user_json)
        .map_err(|e| anyhow::anyhow!("Failed to parse user: {}", e))?;
    
    Ok(TelegramWebAppInitData {
        query_id: params.get("query_id").cloned(),
        user: Some(user),
        auth_date: params.get("auth_date").and_then(|d| d.parse().ok()).unwrap_or(0),
        hash: hash.clone(),
    })
}
```

**Tokeny używane:** `hmac = "0.12"`, `sha2 = "0.10"`, `hex = "0.4"`, `serde_urlencoded = "0.7"`

**Status:** ✅ Gotowy do produkcji

---

### 2. **Webhook Support**
**Zaimplementowane w:** `backend/src/channels/telegram.rs`

```rust
pub struct TelegramChannel {
    // ... istniejące pola ...
    webhook_url: Option<String>,
    use_webhook: bool,
}

/// Switch to webhook mode
pub async fn setup_webhook(&self, url: &str) -> anyhow::Result<()> {
    let body = serde_json::json!({
        "url": url,
        "secret_token": self.webhook_secret(),
    });
    
    let resp = self.http_client()
        .post(self.api_url("setWebhook"))
        .json(&body)
        .send()
        .await?;
        
    if !resp.status().is_success() {
        anyhow::bail!("Failed to set webhook: {:?}", resp.text().await);
    }
    
    tracing::info!("✅ Webhook set: {} with secret: {}", url, secret);
    Ok(())
}

pub fn is_webhook_enabled(&self) -> bool {
    self.use_webhook
}
```

**Status:** ⚠️ 80% gotowe (endpoint brakuje w gateway/mod.rs)

---

### 3. **Baza Danych**
**Tabele istniejące:**
- ✅ `memories` - (id, key, content, category, embedding, created_at, updated_at, session_id)
- ✅ `agent_tasks` - (id, title, status, parent_id, assigned_hand, created_at, updated_at)
- ✅ `conversation_history` - (id, channel, sender, role, content, timestamp, created_at)
- ✅ `threads` - (id TEXT PRIMARY KEY, session_id INTEGER, title TEXT, is_active BOOLEAN, created_at, updated_at)
- ✅ `thread_skills` - (thread_id TEXT, skill_name TEXT, PRIMARY KEY (thread_id, skill_name))
- ✅ `telegram_sessions` - (id INTEGER PRIMARY KEY, telegram_chat_id BIGINT UNIQUE, zero_claw_user_id TEXT, auth_token TEXT, last_active TIMESTAMP, created_at TIMESTAMP)

**Indeksy i klucze obce:**
- ✅ threads.session_id REFERENCES telegram_sessions(id) ON DELETE CASCADE
- ✅ thread_skills.thread_id REFERENCES threads(id) ON DELETE CASCADE

**Status:** ✅ Gotowe do produkcji

---

### 4. **Gateway REST API**
**Zaimplementowane endpointy:**
- ✅ GET/PUT `/api/config`, `/api/v1/config`
- ✅ GET `/api/v1/metrics`
- ✅ POST `/api/pair`, `/api/v1/pair`
- ✅ GET `/api/status`, `/api/v1/status`
- ✅ GET `/api/tools`, `/api/cron`
- ✅ GET/POST/DELETE `/api/memory`
- ✅ GET `/api/chat/history/{session_id}`
- ✅ GET `/api/cost`, `/api/cli-tools`, `/api/health`
- ✅ POST `/api/chat`, `/api/agents/active`
- ✅ GET `/api/routing/status`, `/api/diagnostic`, `/api/validate`
- ✅ GET/POST/PUT/DELETE `/api/tasks`, `/api/v1/tasks`

**Status:** ✅ Gotowe (~70%)

---

### 5. **WebSocket Gateway**
**Lokalizacja:** `/home/ubuntu/zeroclaw-migration-bundle/backend/src/gateway/ws.rs`
**Rozmiar:** 6,969 bajtów
**Status:** ✅ Działa

---

## ❌ CO BRAKUJE

### 1. **Telegram REST API**
**Brakujące endpointy:**
- ❌ POST `/api/v1/telegram/auth` - weryfikacja WebApp initData, zwrócenie JWT token
- ❌ GET `/api/v1/telegram/threads` - pobieranie listy wątków dla użytkownika
- ❌ PUT `/api/v1/telegram/threads/:id/skills` - aktualizacja skilli dla wątku
- ❌ POST `/api/v1/telegram/threads/active` - przełączanie aktywnego wątku

**Wymagane zależności:**
- ❌ `jsonwebtoken` - do generowania JWT tokenów dla TMA auth
- ❌ `jsonwebtoken` feature w Cargo.toml

**Szacowany czas:** 4h

---

### 2. **Frontend TMA (React)**
**Brakujące pliki:**
- ❌ `TelegramHub.tsx` - główny komponent TMA
- ❌ `src/pages/tma/hub.tsx` - strona hub
- ❌ `src/lib/telegram.ts` - obsługa WebApp initData i JWT auth
- ❌ `src/App.tsx` - routing dla /tma/hub
- ❌ Struktura projektu React (src/, package.json, tsconfig.json, vite.config.ts)
- ❌ Tailwind CSS konfiguracja

**Status:** ❌ Nie znaleziono

**Szacowany czas:** 4h

---

### 3. **Inline Keyboards**
**Brakujące elementy w telegram.rs:**
- ❌ Struktura `InlineKeyboard`
- ❌ Struktura `InlineKeyboardButton`
- ❌ Obsługa `callback_query` w listen()
- ❌ Metoda `send_with_keyboard()`
- ❌ Metoda `answerCallbackQuery`

**Szacowany czas:** 2h

---

### 4. **Circuit Breaker**
**Brakujące elementy w TelegramChannel:**
- ❌ Pole `failure_count: AtomicU32`
- ❌ Pole `circuit_open: AtomicBool`
- ❌ Pole `last_failure_time: AtomicU64`
- ❌ Metoda `check_circuit_breaker()`
- ❌ Metoda `record_success()`
- ❌ Metoda `record_failure()`

**Status:** ❌ Nie zaimplementowane

**Szacowany czas:** 2h

---

## 🎯 PLAN IMPLEMENTACJI

### Faza 1: Telegram REST API (HIGH - 4h)
**Cel:** Utworzyć REST API dla Telegrama (auth, threads, skills)

**1. Dodaj zależności do Cargo.toml:**
```toml
[dependencies]
jsonwebtoken = "9"
```

**2. Stwórz `backend/src/gateway/telegram_api.rs`:**
```rust
use super::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use jsonwebtoken::{encode, EncodingKey, Header};
use chrono::{Duration, Utc};

/// Request: Verify WebApp initData
#[derive(Debug, Deserialize)]
pub struct TelegramAuthRequest {
    pub init_data: String,
}

/// Response: JWT token
#[derive(Debug, Serialize)]
pub struct TelegramAuthResponse {
    pub success: bool,
    pub token: Option<String>,
    pub user_id: Option<i64>,
}

/// Get threads for user
pub async fn handle_telegram_auth(
    State(state): State<AppState>,
    Json(body): Json<TelegramAuthRequest>,
) -> impl IntoResponse {
    // Verify WebApp initData using telegram channel
    let telegram = state.telegram.lock().clone();
    
    match telegram.verify_webapp_initdata(&body.init_data) {
        Ok(init_data) => {
            // Generate JWT token
            let secret = state.jwt_secret.clone();
            let expiration = Utc::now() + Duration::hours(24);
            
            let claims = serde_json::json!({
                "user_id": init_data.user.as_ref().map(|u| u.id),
                "telegram_chat_id": init_data.user.as_ref().map(|u| u.id),
                "exp": expiration.timestamp(),
            });
            
            let token = match encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_ref())) {
                Ok(t) => t,
                Err(e) => return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "success": false,
                        "error": format!("JWT generation failed: {}", e)
                    }))
                ).into_response()
            };
            
            (
                StatusCode::OK,
                Json(TelegramAuthResponse {
                    success: true,
                    token: Some(token),
                    user_id: init_data.user.as_ref().map(|u| u.id),
                })
            ).into_response()
        }
        Err(e) => {
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "success": false,
                    "error": format!("Invalid initData: {}", e)
                }))
            ).into_response()
        }
    }
}

/// Get threads for user
pub async fn handle_telegram_threads_get(
    State(state): State<AppState>,
    Query(params): Query<TelegramThreadsParams>,
) -> impl IntoResponse {
    let telegram = state.telegram.lock().clone();
    
    // TODO: Implement DB query for threads
    // SELECT * FROM threads WHERE zero_claw_user_id = ? ORDER BY updated_at DESC
    
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "threads": []
        }))
    ).into_response()
}

/// Update thread skills
pub async fn handle_telegram_thread_skills_update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<TelegramThreadSkillsUpdate>,
) -> impl IntoResponse {
    // TODO: Implement DB update
    // UPDATE thread_skills SET skill_name = ? WHERE thread_id = ? AND skill_name = ?
    
    (StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
        "updated": true
        }))
    ).into_response()
}

/// Set active thread
pub async fn handle_telegram_thread_active(
    State(state): State<AppState>,
    Json(body): Json<TelegramThreadActive>,
) -> impl IntoResponse {
    // TODO: Implement DB update
    // UPDATE threads SET is_active = 1 WHERE id = ?
    
    (StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "activated": true
        }))
    ).into_response()
}
```

**3. Dodaj routing w gateway/mod.rs:**
```rust
.route("/api/v1/telegram/auth", post(telegram_api::handle_telegram_auth))
.route("/api/v1/telegram/threads", get(telegram_api::handle_telegram_threads_get))
.route("/api/v1/telegram/threads/{id}/skills", put(telegram_api::handle_telegram_thread_skills_update))
.route("/api/v1/telegram/threads/active", post(telegram_api::handle_telegram_thread_active))
```

---

### Faza 2: Frontend TMA (HIGH - 4h)
**Cel:** Utworzyć React frontend dla Telegram TMA (hub, conversations, loadout)

**1. Struktura projektu:**
```
frontend-web/
├── src/
│   ├── pages/
│   │   └── tma/
│   │       └── hub.tsx
│   ├── lib/
│   │   └── telegram.ts
│   ├── App.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

**2. TelegramHub.tsx:**
```tsx
import { useState, useEffect } from 'react';
import { TelegramHub } from './components/TelegramHub';
import { telegramAuth } from './lib/telegram';

export default function TelegramHubPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [loadout, setLoadout] = useState<string[]>([]);

  useEffect(() => {
    // Check WebApp auth
    const initData = window.Telegram.WebApp?.initData;
    if (!initData) {
      window.location.href = '/';
      return;
    }

    telegramAuth(initData)
      .then(response => {
        if (response.success) {
          setIsAuthenticated(true);
          // Store JWT token
          localStorage.setItem('telegram_jwt_token', response.token);
          
          // Fetch threads
          fetch('/api/v1/telegram/threads')
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                setThreads(data.threads);
                if (data.threads.length > 0) {
                  setActiveThread(data.threads[0].id);
                }
              }
            });
        }
      })
      .catch(err => {
        console.error('Auth failed:', err);
      });
    }
  }, []);

  const handleThreadSelect = (threadId: string) => {
    fetch(`/api/v1/telegram/threads/active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('telegram_jwt_token')}`
      },
      body: JSON.stringify({ thread_id })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setActiveThread(threadId);
      }
    });
  };

  const handleSkillToggle = (threadId: string, skillName: string) => {
    fetch(`/api/v1/telegram/threads/${threadId}/skills`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('telegram_jwt_token')}`
      },
      body: JSON.stringify({ skills: [skillName] })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setLoadout(prev => 
          prev.includes(skillName) 
            ? prev.filter(s => s !== skillName)
            : [...prev, skillName]
        );
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Telegram Hub
        </h1>
      </header>
      
      {!isAuthenticated ? (
        <div className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Authenticating with Telegram...
          </p>
        </div>
      ) : (
        <div className="p-6 max-w-4xl mx-auto">
          <TelegramHub 
            threads={threads}
            activeThread={activeThread}
            onThreadSelect={handleThreadSelect}
            loadout={loadout}
            onSkillToggle={handleSkillToggle}
          />
        </div>
      )}
    </div>
  );
}
```

**3. telegram.ts:**
```typescript
const API_BASE = '/api/v1/telegram';

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export interface ThreadsResponse {
  success: boolean;
  threads: Thread[];
  user?: TelegramUser;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user_id?: number;
}

export async function telegramAuth(initData: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ init_data })
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  return response.json();
}

export async function getThreads(): Promise<ThreadsResponse> {
  const token = localStorage.getItem('telegram_jwt_token');
  const response = await fetch(`${API_BASE}/threads`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Get threads failed: ${response.status}`);
  }

  return response.json();
}

export async function setActiveThread(threadId: string): Promise<void> {
  const token = localStorage.getItem('telegram_jwt_token');
  await fetch(`${API_BASE}/threads/active`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ thread_id: threadId })
  });
}

export async function updateThreadSkills(threadId: string, skills: string[]): Promise<void> {
  const token = localStorage.getItem('telegram_jwt_token');
  await fetch(`${API_BASE}/threads/${threadId}/skills`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ skills })
  });
}
```

---

### Faza 3: Inline Keyboards (MEDIUM - 2h)
**Cel:** Dodawać obsługę inline keyboardów w telegram.rs

**1. Dodaj struktury w telegram.rs:**
```rust
#[derive(Debug, Clone, Serialize)]
pub struct InlineKeyboard {
    pub inline_keyboard: Vec<Vec<InlineKeyboardButton>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InlineKeyboardButton {
    pub text: String,
    pub callback_data: Option<String>,
    pub url: Option<String>,
}
```

**2. Dodaj metodę send_with_keyboard:**
```rust
impl TelegramChannel {
    pub async fn send_with_keyboard(
        &self,
        chat_id: &str,
        text: &str,
        keyboard: &InlineKeyboard,
    ) -> anyhow::Result<i64> {
        let body = serde_json::json!({
            "chat_id": chat_id,
            "text": text,
            "reply_markup": keyboard,
        });
        
        let resp = self.client
            .post(self.api_url("sendMessage"))
            .json(&body)
            .send()
            .await?;
        
        if !resp.status().is_success() {
            anyhow::bail!("Telegram sendMessage with keyboard failed: {:?}", resp.text().await);
        }
        
        let resp_json: serde_json::Value = resp.json().await?;
        let message_id = resp_json
            .get("result")
            .and_then(|r| r.get("message_id"))
            .and_then(|id| id.as_i64())
            .ok_or_else(|| anyhow::anyhow!("No message_id in response"))?;
        
        Ok(message_id)
    }
}
```

**3. Dodaj obsługę callback_query w listen():**
```rust
// W listen() dodaj:
if let Some(callback_query) = update.get("callback_query") {
    let query_id = callback_query["id"].as_str();
    let data = callback_query["data"].as_str();
    
    // Przetwórz callback
    match data.as_str() {
        "thread_create" => {
            // Utwórz nowy wątek
        }
        "skill_toggle" => {
            // Przełącz skill dla wątku
        }
        _ => {
            tracing::debug!("Unknown callback data: {}", data);
        }
    }
    
    // Odpowiedz na callback
    let answer_body = serde_json::json!({
        "callback_query_id": query_id,
        "text": "Przetworzono",
        "show_alert": false
    });
    
    if let Err(e) = self.http_client()
        .post(self.api_url("answerCallbackQuery"))
        .json(&answer_body)
        .send()
        .await {
        tracing::warn!("Failed to answer callback query: {:?}", e);
    }
}
```

---

### Faza 4: Circuit Breaker (MEDIUM - 2h)
**Cel:** Odporność na awarie API Telegrama

**1. Dodaj pola do TelegramChannel:**
```rust
use std::sync::atomic::{AtomicU32, AtomicBool, AtomicU64, Ordering};

pub struct TelegramChannel {
    // ... istniejące pola ...
    failure_count: AtomicU32,
    circuit_open: AtomicBool,
    last_failure_time: AtomicU64,
}
```

**2. Zaimplementuj metody Circuit Breaker:**
```rust
impl TelegramChannel {
    fn check_circuit_breaker(&self) -> bool {
        let failures = self.failure_count.load(Ordering::Relaxed);
        let open = self.circuit_open.load(Ordering::Relaxed);
        
        if failures >= 5 {
            self.circuit_open.store(true, Ordering::Relaxed);
            return false;
        }
        
        if open {
            let last_fail = self.last_failure_time.load(Ordering::Relaxed);
            let elapsed = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as u64 - last_fail;
            
            // Otwórz po 60 sekundach
            if elapsed > 60 {
                self.circuit_open.store(false, Ordering::Relaxed);
                return true;
            }
            return false;
        }
        
        true
    }
    
    fn record_success(&self) {
        self.failure_count.store(0, Ordering::Relaxed);
    }
    
    fn record_failure(&self) {
        let failures = self.failure_count.fetch_add(1, Ordering::Relaxed);
        self.last_failure_time.store(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as u64,
            Ordering::Relaxed
        );
        
        if failures >= 5 {
            self.circuit_open.store(true, Ordering::Relaxed);
            tracing::warn!("Circuit breaker opened after {} failures", failures);
        }
    }
}
```

**3. Użyj check_circuit_breaker() przed każdą operacją API:**
```rust
// W metodach send() użyj:
if !self.check_circuit_breaker() {
    tracing::warn!("Circuit breaker is open - skipping operation");
    return Ok(());
}

// Po sukcesie:
self.record_success();

// Po błędzie:
self.record_failure();
```

---

## 🎯 PODSUMOWANIE

**Czas implementacji:** 12 godzin (4h + 4h + 2h + 2h)
**Cel:** Pełna implementacja Telegram Zero-Bloat

**Kolejność faz:**
1. ✅ TMA Auth verification - GOTOWE
2. ⚠️ Webhook Support - 80% gotowe (brakuje endpoint w gateway)
3. ✅ Baza Danych - GOTOWE
4. ✅ Gateway REST API - GOTOWE (~70%)
5. ❌ Telegram REST API - BRAKUJE (4h)
6. ❌ Frontend TMA - BRAKUJE (4h)
7. ❌ Inline Keyboards - BRAKUJE (2h)
8. ❌ Circuit Breaker - BRAKUJE (2h)

**Po ukończeniu faz 1-8:**
ZeroClaw będzie mieć pełne wsparcie dla Telegrama z TMA, inline keyboards i circuit breaker!

---

## 💡 ZALECENIA KOŃCOWE

1. **Testy:** Po każdej fazie przetestuj end-to-end (curl, Postman, Telegram WebApp)
2. **Dokumentacja:** Aktualizuj dokumentację z przykładami użycia
3. **CORS:** Upewnij się że API endpoints mają odpowiednie CORS headers
4. **Security:** Przechowuj JWT tokens bezpiecznie, używaj env vars
5. **DB Performance:** Używaj prepared statements i indeksy dla wydajności

---

**Raport wygenerowany:** 2026-03-13  
**ZeroClaw status:** 🟡 W toku implementacji
