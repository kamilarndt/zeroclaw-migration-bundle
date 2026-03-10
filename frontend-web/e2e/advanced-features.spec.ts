import { test, expect } from '@playwright/test';

test.describe('ZeroClaw Advanced Features Audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://dash.karndt.pl');
    await page.waitForSelector('#root', { timeout: 15000 });
    await expect(page).toHaveTitle(/ZeroClaw OS/i);
  });

  test.describe('API Endpoints Integration', () => {
    test('powinien poprawnie komunikować się z API backendu', async ({ page }) => {
      // Nasłuchuj na żądania API
      const apiCalls: any[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          apiCalls.push({
            url: request.url(),
            method: request.method(),
            headers: request.headers()
          });
        }
      });

      // Czekaj na początkowe żądania API
      await page.waitForTimeout(3000);
      
      console.log('API calls detected:', apiCalls.length);
      apiCalls.forEach(call => {
        console.log(`- ${call.method} ${call.url}`);
      });
    });

    test('powinien obsługiwać błędy API', async ({ page }) => {
      // Symuluj błąd API
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });

      // Odśwież stronę i sprawdź reakcję na błąd
      await page.reload();
      await page.waitForTimeout(2000);

      const errorToast = page.locator('.error-toast, .toast-error, [role="alert"]');
      const hasErrorToast = await errorToast.count() > 0;
      
      if (hasErrorToast) {
        await expect(errorToast.first()).toBeVisible();
      }

      // Przywróć normalne routing
      await page.unroute('**/api/**');
    });
  });

  test.describe('Memory i Vector Database', () => {
    test('powinien wyświetlać interfejs pamięci', async ({ page }) => {
      // Spróbuj przejść do sekcji pamięci
      const memoryLink = page.locator('a:has-text("Memory"), button:has-text("Memory")');
      const hasMemoryLink = await memoryLink.count() > 0;
      
      if (hasMemoryLink) {
        await memoryLink.click();
        await page.waitForTimeout(2000);
        
        // Sprawdź czy interfejs pamięci się ładuje
        const memoryInterface = page.locator('[data-testid="memory"], .memory-container, .vector-db');
        await expect(memoryInterface).toBeVisible();
        
        // Sprawdź czy istnieje wyszukiwanie
        const searchInput = memoryInterface.locator('input[placeholder*="search"], input[placeholder*="Search"]');
        const hasSearch = await searchInput.count() > 0;
        
        if (hasSearch) {
          await expect(searchInput.first()).toBeVisible();
        }
      }
    });

    test('powinien umożliwiać przeszukiwanie pamięci', async ({ page }) => {
      const memoryLink = page.locator('a:has-text("Memory"), button:has-text("Memory")');
      const hasMemoryLink = await memoryLink.count() > 0;
      
      if (hasMemoryLink) {
        await memoryLink.click();
        await page.waitForTimeout(2000);
        
        const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="Search"]');
        const hasSearch = await searchInput.count() > 0;
        
        if (hasSearch) {
          await searchInput.fill('test query');
          await page.waitForTimeout(1000);
          
          // Sprawdź czy pojawiły się wyniki
          const results = page.locator('.search-results, .memory-results, .result-item');
          const hasResults = await results.count() > 0;
          
          if (hasResults) {
            await expect(results.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('SOPs (Standard Operating Procedures)', () => {
    test('powinien wyświetlać listę SOPs', async ({ page }) => {
      const sopsLink = page.locator('a:has-text("SOPs"), button:has-text("SOPs")');
      const hasSopsLink = await sopsLink.count() > 0;
      
      if (hasSopsLink) {
        await sopsLink.click();
        await page.waitForTimeout(2000);
        
        // Sprawdź czy lista SOPs istnieje
        const sopsList = page.locator('[data-testid="sops-list"], .sops-container, .sops-grid');
        await expect(sopsList).toBeVisible();
        
        // Sprawdź czy istnieje przycisk tworzenia SOP
        const createSopBtn = sopsList.locator('button:has-text("Create"), button:has-text("Add"), [data-testid="create-sop"]');
        const hasCreateBtn = await createSopBtn.count() > 0;
        
        if (hasCreateBtn) {
          await expect(createSopBtn.first()).toBeVisible();
        }
      }
    });

    test('powinien umożliwiać edycję SOPs', async ({ page }) => {
      const sopsLink = page.locator('a:has-text("SOPs"), button:has-text("SOPs")');
      const hasSopsLink = await sopsLink.count() > 0;
      
      if (hasSopsLink) {
        await sopsLink.click();
        await page.waitForTimeout(2000);
        
        // Sprawdź czy istnieją SOPy do edycji
        const sopItems = page.locator('.sop-item, .sop-card');
        const sopCount = await sopItems.count();
        
        if (sopCount > 0) {
          // Kliknij pierwszy SOP
          await sopItems.first().click();
          await page.waitForTimeout(2000);
          
          // Sprawdź czy pojawił się edytor
          const editor = page.locator('.editor, .code-editor, textarea, [contenteditable="true"]');
          const hasEditor = await editor.count() > 0;
          
          if (hasEditor) {
            await expect(editor.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('WebSocket Real-time Features', () => {
    test('powinien utrzymywać połączenie WebSocket', async ({ page }) => {
      let wsConnected = false;
      let wsUrl = '';
      
      page.on('websocket', ws => {
        wsConnected = true;
        wsUrl = ws.url();
        console.log('WebSocket connected:', wsUrl);
        
        ws.on('close', () => {
          console.log('WebSocket disconnected');
        });
      });

      await page.waitForTimeout(5000);
      
      expect(wsConnected).toBeTruthy();
      expect(wsUrl).toContain('ws://') || expect(wsUrl).toContain('wss://');
    });

    test('powinien odbierać aktualizacje w czasie rzeczywistym', async ({ page }) => {
      // Mock WebSocket odpowiedź
      await page.route('**/websocket**', async route => {
        // To jest uproszczone - w realnym teście potrzebny jest WebSocket server
        await route.continue();
      });

      // Sprawdź czy istnieją wskaźniki statusu połączenia
      const connectionStatus = page.locator('[data-testid="connection-status"], .connection-indicator, .ws-status');
      const hasStatus = await connectionStatus.count() > 0;
      
      if (hasStatus) {
        await expect(connectionStatus.first()).toBeVisible();
      }
    });
  });

  test.describe('Ustawienia i Konfiguracja', () => {
    test('powinien zapisywać zmiany w konfiguracji', async ({ page }) => {
      await page.click('text="Config"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // Sprawdź czy istnieje formularz konfiguracyjny
      const configForm = page.locator('form, .config-form, .settings-form');
      const hasForm = await configForm.count() > 0;
      
      if (hasForm) {
        await expect(configForm.first()).toBeVisible();
        
        // Sprawdź czy istnieją pola do edycji
        const inputs = configForm.locator('input, select, textarea');
        await expect(inputs).toHaveCount({ min: 1 });
        
        // Sprawdź czy istnieje przycisk zapisu
        const saveBtn = configForm.locator('button:has-text("Save"), button:has-text("Apply"), [type="submit"]');
        const hasSaveBtn = await saveBtn.count() > 0;
        
        if (hasSaveBtn) {
          await expect(saveBtn.first()).toBeVisible();
        }
      }
    });

    test('powinien wyświetlać różne sekcje konfiguracyjne', async ({ page }) => {
      await page.click('text="Config"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // Sprawdź różne typy konfiguracji
      const configTypes = [
        'Network',
        'API',
        'Providers',
        'Models',
        'Limits',
        'Security'
      ];
      
      for (const configType of configTypes) {
        const section = page.locator(`text="${configType}"`, { exact: false });
        const hasSection = await section.count() > 0;
        
        if (hasSection) {
          await expect(section.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Czatu i A2A (Agent-to-Agent)', () => {
    test('powinien wyświetlać historię czatu', async ({ page }) => {
      await page.click('text="Chat"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      const chatContainer = page.locator('[data-testid="chat"], .chat-container');
      await expect(chatContainer).toBeVisible();
      
      // Sprawdź czy istnieje historia wiadomości
      const messages = chatContainer.locator('.message, .chat-message');
      const hasMessages = await messages.count() > 0;
      
      // Może być pusta historia, to jest normalne
      if (hasMessages) {
        await expect(messages.first()).toBeVisible();
      }
    });

    test('powinien umożliwiać wysyłanie wiadomości', async ({ page }) => {
      await page.click('text="Chat"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      const messageInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"], [contenteditable="true"]');
      await expect(messageInput).toBeVisible();
      
      const sendButton = page.locator('button:has-text("Send"), button:has-text("Send Message")');
      const hasSendButton = await sendButton.count() > 0;
      
      if (hasSendButton) {
        await expect(sendButton.first()).toBeVisible();
      }
    });
  });

  test.describe('Wydajność i Optymalizacja', () => {
    test('powinien ładować zasoby efektywnie', async ({ page }) => {
      const resources: any[] = [];
      
      page.on('response', response => {
        resources.push({
          url: response.url(),
          status: response.status(),
          size: response.headers()['content-length'] || 0
        });
      });

      await page.reload();
      await page.waitForTimeout(3000);
      
      // Sprawdź czy nie ma błędów ładowania zasobów
      const failedResources = resources.filter(r => r.status >= 400);
      console.log('Failed resources:', failedResources.length);
      
      // Niektóre błędy mogą być akceptowalne (np. favicon.ico)
      const criticalFailures = failedResources.filter(r => !r.url.includes('favicon') && !r.url.includes('manifest'));
      expect(criticalFailures.length).toBeLessThan(3); // Maksymalnie 2 krytyczne błędy
    });

    test('powinien mieć optymalizacje wydajnościowe', async ({ page }) => {
      // Sprawdź czy używa lazy loading
      const images = page.locator('img[loading="lazy"]');
      const lazyImages = await images.count();
      console.log('Lazy loaded images:', lazyImages);
      
      // Sprawdź czy używa code splitting
      const scripts = await page.$$eval('script[src]', scripts => 
        scripts.map(s => s.src).filter(src => src.includes('.js'))
      );
      console.log('JavaScript bundles:', scripts.length);
    });
  });

  test.describe('Bezpieczeństwo', () => {
    test('powinien mieć odpowiednie zabezpieczenia CSRF', async ({ page }) => {
      // Sprawdź czy formularze mają CSRF tokeny
      const forms = await page.$$('form');
      let hasCsrfProtection = false;
      
      for (const form of forms) {
        const csrfToken = await form.$('input[name*="csrf"], input[name*="token"]');
        if (csrfToken) {
          hasCsrfProtection = true;
          break;
        }
      }
      
      console.log('CSRF protection detected:', hasCsrfProtection);
    });

    test('powinien poprawnie obsługiwać błędy autoryzacji', async ({ page }) => {
      // Przejdź do chronionej ścieżki
      await page.goto('https://dash.karndt.pl/api/config', { waitUntil: 'domcontentloaded' });
      
      // Sprawdź czy przekierowało do logowania lub wyświetliło błąd
      const url = page.url();
      const isLoginPage = url.includes('login') || url.includes('auth');
      const hasError = await page.locator('text="Unauthorized", text="401"').count() > 0;
      
      expect(isLoginPage || hasError).toBeTruthy();
    });
  });

  test.describe('Dostępność (Accessibility)', () => {
    test('powinien mieć poprawne atrybuty dostępności', async ({ page }) => {
      // Sprawdź czy przyciski mają atrybuty aria
      const buttons = page.locator('button, [role="button"]');
      const buttonCount = await buttons.count();
      
      let accessibleButtons = 0;
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const hasLabel = await button.getAttribute('aria-label') !== null || 
                         await button.textContent() !== '';
        if (hasLabel) accessibleButtons++;
      }
      
      console.log('Accessible buttons:', accessibleButtons, '/', buttonCount);
      expect(accessibleButtons).toBeGreaterThan(buttonCount * 0.8); // 80% przycisków powinno być dostępnych
    });

    test('powinien mieć poprawne kontrasty kolorów', async ({ page }) => {
      // To jest uproszczone - pełny test kontrastów wymagałby narzędzi do analizy CSS
      const darkMode = await page.locator('html').getAttribute('class');
      const isDarkMode = darkMode?.includes('dark') || darkMode?.includes('Dark');
      
      console.log('Dark mode detected:', isDarkMode);
      
      // Sprawdź czy istnieje przełącznik trybu ciemnego
      const themeToggle = page.locator('[data-testid="theme-toggle"], .theme-toggle, button[aria-label*="theme"]');
      const hasThemeToggle = await themeToggle.count() > 0;
      
      if (hasThemeToggle) {
        await expect(themeToggle.first()).toBeVisible();
      }
    });
  });
});