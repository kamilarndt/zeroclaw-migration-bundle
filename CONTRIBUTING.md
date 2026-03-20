# Contributing to ZeroClaw OS

Dziękujemy za zainteresowanie wkładem w rozwój ZeroClaw OS! 🦀

---

## 🤝 Jak Contributować

### Zgłaszanie Bugów

Przed zgłoszeniu błędu:

1. Sprawdź czy problem nie został już zgłoszony w [Issues](https://github.com/zeroclaw-labs/zeroclaw/issues)
2. Upewnij się, że używasz najnowszej wersji
3. Zbierz informacje o środowisku:
   - System operacyjny i wersja
   - Wersja Rust (`rustc --version`)
   - Wersja Node (`node --version`)
   - Wersja ZeroClaw (`zeroclaw --version`)

Twórz issue z:
- Jasnym tytułem opisującym problem
- Szczegółowym opisem jak odtworzyć błąd
- Oczekiwanym vs rzeczywistym zachowaniem
- Logami (jeśli dotyczy)

### Proponowanie Nowych Funkcji

1. Otwórz Discussion lub Issue z opisem funkcji
2. Opisz use case i dlaczego jest przydatny
3. Rozważ implementację i wpływ na wydajność
4. Czekaj na feedback przed rozpoczęciem pracy

### Pull Requests

1. **Forknij repozytorium**
   ```bash
   git clone https://github.com/YOUR_USERNAME/zeroclaw.git
   cd zeroclaw
   ```

2. **Utwórz branch dla funkcji**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Wprowadź zmiany**
   - Postępuj zgodnie ze stylem code'owania
   - Dodaj testy dla nowych funkcji
   - Aktualizuj dokumentację

4. **Commituj z conventionaal commits**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

5. **Push i tworzenie PR**
   ```bash
   git push origin feature/amazing-feature
   # Otwórz Pull Request na GitHub
   ```

---

## 📝 Convention Commits

Używamy formatu conventional commits:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Typy:
- `feat`: Nowa funkcja
- `fix`: Poprawka błędu
- `docs`: Zmiana w dokumentacji
- `style`: Zmiana formatowania (nie wpływająca na kod)
- `refactor`: Refaktoryzacja kodu
- `perf`: Poprawa wydajności
- `test`: Dodanie/aktualizacja testów
- `chore`: Zmiana w procesie build/ narzędziach
- `ci`: Zmiana w CI/CD

### Przykłady:
```bash
feat(routing): add smart quota-based routing
fix: resolve memory leak in websocket handler
docs: update installation guide for ubuntu 24.04
refactor(quota): simplify state machine logic
test: add integration tests for provider switching
```

---

## 🎨 Style Guide

### Rust (Backend)

**Formatowanie:**
```bash
cargo fmt
```

**Linting:**
```bash
cargo clippy -- -D warnings
```

**Zasady:**
- Używaj `rustfmt` przed commitem
- Popraw wszystkie `clippy` warnings
- Preferuj `anyhow::Result` nad `Box<dyn Error>`
- Używaj `tracing` zamiast `println!`
- Dokumentuj publiczne API z `///`

**Przykład:**
```rust
use anyhow::{Result, Context};
use tracing::{info, debug};

/// Processes a chat request with smart routing.
///
/// # Arguments
///
/// * `request` - The chat request to process
///
/// # Returns
///
/// A `Result` containing the chat response
///
/// # Errors
///
/// Returns an error if:
/// - Provider is unavailable
/// - Quota is exceeded
/// - Request is invalid
pub async fn process_chat(request: ChatRequest) -> Result<ChatResponse> {
    info!("Processing chat request: {:?}", request);
    // Implementation
}
```

### TypeScript/React (Frontend)

**Formatowanie:**
```bash
cd frontend-web
npm run lint
```

**Linting:**
```bash
npm run type-check
```

**Zasady:**
- Używaj functional components z hooks
- Preferuj Zustand dla globalnego stanu
- TypeScript strict mode - bez `any`
- Formatuj z Prettier
- Używaj `React.memo` tylko gdy potrzebne

**Przykład:**
```typescript
import { useState } from 'react';
import { useAgentStore } from '@/stores/agentStore';

interface AgentCardProps {
  agentId: string;
  onStatusChange?: (status: AgentStatus) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
  agentId,
  onStatusChange
}) => {
  const { agents, updateAgentStatus } = useAgentStore();
  const [isLoading, setIsLoading] = useState(false);

  const agent = agents.find(a => a.id === agentId);

  if (!agent) {
    return <div>Agent not found</div>;
  }

  // Component implementation
};
```

---

## 🧪 Testowanie

### Backend (Rust)

**Unit tests:**
```bash
cd backend
cargo test
```

**Integration tests:**
```bash
cargo test --test integration
```

**Benchmarking:**
```bash
cargo bench
```

**Zasady:**
- Pisz testy dla nowych funkcji
- Utrzymuj >80% code coverage
- Używaj `tokio::test` dla async testów
- Mockuj external dependencies

### Frontend (TypeScript)

**Unit tests:**
```bash
cd frontend-web
npm test
```

**E2E tests:**
```bash
npm run test:e2e
```

**Zasady:**
- Testuj komponenty z React Testing Library
- Używaj user-centric queries (`getByRole`, `getByText`)
- Mock API responses w unit testach
- E2E dla critical user paths

---

## 📋 Przed Złożeniem PR

Upewnij się, że:

- [ ] Kod przechodzi `cargo test` (backend)
- [ ] Kod przechodzi `npm test` (frontend)
- [ ] Brak warnings z `cargo clippy`
- [ ] Brak błędów z `npm run type-check`
- [ ] Dodałeś/aś testy dla nowych funkcji
- [ ] Zaktualizowałeś/aś dokumentację
- [ ] Commit messages są conventional commits
- [ ] PR description jasno opisuje zmiany

---

## 🏗️ Architektura

Przed wprowadzeniem dużych zmian, zapoznaj się z:

- **[MASTER_ARCHITECTURE.md](./backend/docs/MASTER_ARCHITECTURE.md)** - Główna architektura
- **[backend/CLAUDE.md](./backend/CLAUDE.md)** - Kontekst dla AI assistant
- **[REFACTORING_PLAN.md](./backend/docs/REFACTORING_PLAN.md)** - Planowane refaktoryzacje

### Kluczowe koncepcje:

**Backend:**
- Agent system z multi-channel routing
- Smart quota tracking ze state machine
- Multi-provider abstraction layer
- SQLite + Qdrant dla pamięci

**Frontend:**
- React 19 z concurrent features
- Zustand dla lekkiego state management
- ReactFlow dla workflow editor
- PWA z offline capabilities

---

## 🚀 Development Workflow

1. **Rozpocznij od issue/discussion**
   - Zgłoś zamiar wprowadzenia zmian
   - Otrzymaj feedback od maintainerów

2. **Utwórz branch**
   ```bash
   git checkout -b feature/your-feature
   ```

3. **Implementuj i testuj**
   - Regularnie commity z conventionaal commits
   - Uruchamiaj testy lokalnie
   - Aktualizuj dokumentację

4. **Zanim stworzysz PR**
   - Rebase na latest main
   - Upewnij się że tests pass
   - Sprawdź clippy/linting

5. **Stwórz PR**
   - Jasny tytuł z conventionaal commit
   - Szczegółowy opis zmian
   - Linki do związanych issues
   - Screenshots dla UI changes

6. **Code review**
   - Odpowiadaj na komentarze
   - Wprowadzaj poprawki
   - Bądź cierpliwy - review może potrwać

---

## 📧 Kontakt

Pytania? Skontaktuj się z nami:

- **GitHub Issues:** https://github.com/zeroclaw-labs/zeroclaw/issues
- **GitHub Discussions:** https://github.com/zeroclaw-labs/zeroclaw/discussions
- **Telegram:** https://t.me/zeroclawlabs
- **X:** [@zeroclawlabs](https://x.com/zeroclawlabs)

---

## 📄 Licencja

Wkładąc w projekt, zgadzasz się że Twoje contributions będą dual-licensed pod MIT OR Apache-2.0, tak jak główny projekt.

---

**Dziękujemy za contrib! 🙏**
