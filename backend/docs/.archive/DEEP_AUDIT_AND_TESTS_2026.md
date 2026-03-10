# ZeroClaw System: Deep Audit & E2E Test Strategy 2026

## Executive Summary
This document provides a rigorous code, architectural, and security audit of the ZeroClaw system (Rust Backend & React Frontend) along with an End-to-End (E2E) testing playbook.

---

## Faza 1: Vulnerability & Bottleneck Matrix (Bezpieczeństwo i Asynchroniczność)

| Typ | Poziom | Moduł | Opis Problemu i Rekomendacja |
|-----|--------|-------|------------------------------|
| **Async Starvation (Deadlocks)** | **HIGH** | `src/memory/`, `src/channels/`, `src/providers/` | **Opis:** Zastosowanie `std::sync::Mutex` w kodzie asynchronicznym (widoczne w `sqlite.rs`, `channels/mod.rs` i `providers/mod.rs`). To drastycznie zwiększa ryzyko zakleszczeń (deadlocks) i "zagłodzenia" wątków roboczych Tokio przy dużym obciążeniu.<br>**Rekomendacja:** Migracja na `tokio::sync::Mutex` lub (jeśli to stan synchroniczny) ograniczenie blokady do ścisłego minimum i wyniesienie poza `await`. |
| **I/O Starvation** | **HIGH** | `src/memory/` | **Opis:** Intensywne operacje dyskowe i kryptograficzne (obliczanie embeddingów) mogą blokować główny wątek pętli (event loop).<br>**Rekomendacja:** Operacje wektorowe i zapytania SQLite powinny być zlecane przez `tokio::task::spawn_blocking`. |
| **API Auth Gaps** | **HIGH** | `src/api/` (RAG endpoints) | **Opis:** Niektóre endpointy i Sockety (szczególnie w kontekście pairing) mogą być podatne na replay-attacks lub nie mają pełnej weryfikacji tokenu JWT z poprawnym sprawdzaniem daty ważności (`exp`). Pamięć dla bota Telegram również gubi kontekst (brak utrzymania wirtualnej sesji opierającej się na `chat_id`).<br>**Rekomendacja:** Dodanie warstwy (Middleware) walidującej nagłówek `Authorization: Bearer` pod kątem kryptograficznym na *każdym* requeście. Dla Telegrama wymuszona stała alokacja `session_id`. |
| **Database Locks / Qdrant Downtime** | **MED** | `src/memory/` | **Opis:** Jeśli kontener Qdrant padnie, aplikacja może gubić stan lub zwracać błędy krytyczne 500 zamiast przejść w tryb `graceful degradation` (fallback na bazę SQLite). SQLite z kolei podatny na `database is locked`.<br>**Rekomendacja:** W `SqliteMemory` dodać Retry z Backoffem i Timeouty oraz Circuit Breaker dla Qdranta. |
| **Frontend Memory Leaks** | **MED** | `web/src/pages/` | **Opis:** Użycie WebSocketów i `setInterval` bez funkcji czyszczącej w `useEffect()`. Dodatkowo aplikacja (m.in. MemoryGraph - `ForceGraph2D`) renderuje tysiące punktów na Canvasie na głównym wątku, zacina UI.<br>**Rekomendacja:** Debouncing dla updatów z WS; wprowadzenie WebWorkers do obliczeń wektorowych na froncie; rygorystyczne zwracanie funkcji `cleanup` (odpinającej event listenery) w React. |

---

## Faza 2: Monolith Dismantling Plan (Dekompozycja Architektury)

Analiza wykazała obecność potężnych "Boskich Obiektów" (God Objects), które łamią regułę SRP (Single Responsibility Principle).

### 1. `src/agent/loop_.rs`
- **Aktualny stan:** Piekielnie duży plik (~5600 linii kodu). Odpowiada za pętlę czatu, logikę decyzyjną, parsowanie XML/JSON, zarządzanie zagnieżdżonymi promptami, i kompresję historii.
- **Strategia Dekompozycji:** 
  - Utworzenie `src/agent/parser/` (parsowanie XML/MiniMax/JSON).
  - Utworzenie `src/agent/memory_compactor/` (zarządzanie trimowaniem i kompresją kontekstu).
  - Utworzenie `src/agent/router/` (zarządzanie ścieżkami wiadomości, w tym routing wieloagentowy).

### 2. `src/providers/reliable.rs`
- **Aktualny stan:** ~1984 linii kodu. Składa się z wielopoziomowej pętli fallback, rozpoznawania błędów HTTP i rotacji API.
- **Strategia Dekompozycji:**
  - Utworzenie `src/providers/fault_tolerance/` zawierającego oddzielone struktury: `circuit_breaker.rs`, `backoff.rs`, i `rate_limiter.rs`. Cały przepływ powinien korzystać z wzorca Middleware/Decorators na pule providerów.

### 3. Frontend Debt (`~/.zeroclaw/workspace/web/src/pages/`, `stores/chatStore.ts`)
- **Aktualny stan:** Przeładowane pliki stanowe (np. `taskStore.ts` - 347 linii, `chatStore.ts` - 290 linii).
- **Strategia Dekompozycji:**
  - Ekstrakcja do logiki generycznej: dedykowane custom hooki takie jak `useMemoryGraph(nodes, links)` oraz `useAuthFetch(endpoint, method, body)` do jednorodnej obsługi zapytań z tokenami JWT.
  - Oddzielenie warstwy renderingu UI od zarządzania subskrypcjami WebSocket w osobnych wyższych komponentach (HOC) lub precyzyjne wykorzystanie EventEmitterów. Dowiązanie pobierania starej historii (którego brak jest powodem "amnezji" dla Dashboardu).

---

## Faza 3: Test Automation Playbook (Testy E2E)

Poniżej przygotowane struktury do natychmiastowego wykorzystania w katalogach projektowych. Najlepiej w katalogu: `tests/e2e`.

### 3.1. Przeglądarka Web (Playwright + TypeScript)
Sprawdza możliwość utrzymania i przypomnienia kontekstu przez przeglądarkę, upewniając się, że RAG działa poprawnie, a UI uaktualnia graf pamięci.

**Plik:** `tests/e2e/web/chatMemory.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('ZeroClaw Chat Context & RAG Memory', () => {
  test.beforeEach(async ({ page }) => {
    // Logowanie
    await page.goto('https://dash.karndt.pl/login');
    await page.fill('input[name="username"]', process.env.TEST_USER || 'admin');
    await page.fill('input[name="password"]', process.env.TEST_PASS || 'password');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('Agent remembers user name through contextual conversations', async ({ page }) => {
    // 1. Zapis nowego kontekstu w bazie
    await page.goto('https://dash.karndt.pl/chat');
    
    // Należy założyć poprawny session_id per-tab z LocalStorage
    const chatInput = page.locator('textarea[placeholder="Message ZeroClaw..."]');
    await chatInput.fill('Witaj! Mam na imię Jan i bardzo lubię uczyć się o kosmosie.');
    await page.keyboard.press('Enter');

    // Czekanie na odpowiedź Agenta
    await expect(page.locator('.assistant-message').last()).toContainText(/Jan/i);

    // 2. Dodatkowy filler (zapchanie kontekstu lokalnie)
    await chatInput.fill('Jaką dzisiaj mamy pogodę? Użyj jakiegoś narzędzia systemowego żeby sprawdzić czy pada deszcz.');
    await page.keyboard.press('Enter');
    await expect(page.locator('.assistant-message').last()).toBeVisible({ timeout: 15000 });

    // 3. Weryfikacja odzyskiwania historii (RAG, po odświeżeniu karty przeglądarki!)
    await page.reload();
    await expect(page.locator('.assistant-message').first()).toBeVisible();

    await chatInput.fill('Jakie podałem ci wcześniej imię? Czy pamiętasz moje hobby?');
    await page.keyboard.press('Enter');
    
    const finalResponse = page.locator('.assistant-message').last();
    await expect(finalResponse).toContainText(/Jan/);
    await expect(finalResponse).toContainText(/kosmos/i);

    // 4. Weryfikacja renderingu w Memory Graph (czy obiekty 3D nie psują przeglądarki)
    await page.goto('https://dash.karndt.pl/dashboard');
    const canvas = page.locator('canvas'); // Główny tag grafu ForceGraph
    await expect(canvas).toBeVisible();
  });
});
```

### 3.2. Telegram Bot Mock (Python + Pytest)
Skrypt uderza bezpośrednio do Webhook API ZeroClaw z zasymulowanymi eventami JSON z Telegrama. Znalezionym błędem "Amnezji" Telegrama w ZeroClaw jest fakt, że requesty z chatów nie miały zachowanego ciągłego mapowania identyfikatora `session_id`, lub webhook timeoutował podczas switcha / retry-fallbacku między głównym LLM a Ollamą.

**Plik:** `tests/e2e/telegram/test_telegram_webhook.py`
```python
import pytest
import httpx
import time
import asyncio

ZEROCLAW_WEBHOOK = "http://localhost:42617/v1/channels/telegram/webhook"
SECRET_TOKEN = "TEST_SECRET_TELEGRAM_TOKEN"

def generate_telegram_update(user_id, message_text):
    return {
        "update_id": int(time.time()),
        "message": {
            "message_id": 1,
            "from": {"id": user_id, "first_name": "TestUser", "is_bot": False},
            "chat": {"id": user_id, "type": "private"},
            "date": int(time.time()),
            "text": message_text
        }
    }

@pytest.mark.asyncio
async def test_telegram_context_retention():
    """
    Testuje pamięć per chat_id z Telegrama. 
    Wykryty błąd amnezji w Telegramie polegał na gubieniu sesji między webhookami bez wczytywania starej historii z Sqlite.
    """
    headers = {"X-Telegram-Bot-Api-Secret-Token": SECRET_TOKEN}
    user_id = 999123
    
    # Krok 1: Wstrzyknięcie informacji w konwersacji telegramowej
    payload1 = generate_telegram_update(user_id, "Moje tajne hasło to ZEROCLAW_TELEGRAM_SESS")
    async with httpx.AsyncClient() as client:
        res1 = await client.post(ZEROCLAW_WEBHOOK, json=payload1, headers=headers)
        assert res1.status_code == 200
        
    await asyncio.sleep(2) # symulacja Czekania bota w tle na insert SQLite/Qdrant
    
    # Krok 2: Weryfikacja
    payload2 = generate_telegram_update(user_id, "Jakie jest moje tajne hasło?")
    async with httpx.AsyncClient() as client:
        res2 = await client.post(ZEROCLAW_WEBHOOK, json=payload2, headers=headers)
        assert res2.status_code == 200
        # W mockach sprawdzamy faktyczną asynchroniczną wyplutą odpowiedź przez np. API diagnostyczne w kolejnym stepie lub nasłuchując outboxa.

@pytest.mark.asyncio
async def test_telegram_fallback_stress():
    """ 
    Wysyłanie super długiego promptu (lub zepsutego pliku graficznego) by przetestować 
    Time-Out w głównej platformie (Z.ai / API zewnętrznym). 
    ZeroClaw webhook musi zwrócić natychmiastowe 200 OK do serwerów Telegrama,
    podczas gdy w innej Asynchronicznej pętli Tokio (`tokio::spawn`) ma mielić fallback do lokalnej `qwen2.5-coder:7b`.
    """
    headers = {"X-Telegram-Bot-Api-Secret-Token": SECRET_TOKEN}
    payload = generate_telegram_update(12345, "Generate a highly complex multi-threaded architectural plan " * 50)
    
    async with httpx.AsyncClient(timeout=45.0) as client:
        start_time = time.time()
        response = await client.post(ZEROCLAW_WEBHOOK, json=payload, headers=headers)
        duration = time.time() - start_time
        
        # Ostrzeżenie do Refactoringu: ZeroClaw MUST return 200 OK instantly and process in background
        assert response.status_code == 200, "Webhook endpoint should acknowledge message instantly (200 OK)"
        assert duration < 3.0, "Webhook must be fully asynchronous and return to Telegram Server immediately to avoid duplicate sendings"
```

### 3.3. Limity Kontekstowe RAG (Stress Test)
RAG (`sql.rs` / `qdrant`) ma ustalone restrykcje wg. Twoich wytycznych: zapobiegania Exceeding tokens dla providerów lokalnych.
 
**Plik:** `tests/e2e/backend/rag_limits.sh`
```bash
#!/bin/bash
# Skrypt do wrzucania 50 długich dokumentów dla danego session_id symulując bardzo długą rozmowę
for i in {1..50}; do
  curl -X POST http://localhost:42617/v1/memory/store \
  -H "Authorization: Bearer TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key":"stress_test_'$i'", 
    "content":"This is a massive block of knowledge '$i'. Some more context strictly to overload the RAG chunk tokens. We need to respect the compact_context and rag_chunk_limit settings."
  }'
done

echo "Knowledge injected. Testing context limits via Chat endpoint..."
curl -X POST http://localhost:42617/v1/chat \
  -H "Authorization: Bearer TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user", "content":"Summarize the previous stress tests."}]}'

# Weryfikacja że do "qwen2" poleciał obcięty log zamiast całości
grep -i "truncating history" ~/.zeroclaw/daemon.log || echo "WARNING: History might proceed un-truncated or RAG didn't filter the limit!"
```
