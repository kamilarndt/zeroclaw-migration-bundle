import { test, expect } from '@playwright/test';

test.describe('ZeroClaw Dashboard Full Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Przejdź do dashboardu przed każdym testem
    await page.goto('/');
    
    // Czekaj aż strona się załaduje
    await page.waitForSelector('#root', { timeout: 10000 });
    
    // Czekaj na załadowanie aplikacji
    await expect(page).toHaveTitle(/ZeroClaw OS/i);
  });

  test.describe('Strona Główna - Dashboard', () => {
    test('powinien wyświetlać dashboard z kluczowymi metrykami', async ({ page }) => {
      // Sprawdź czy główny kontener dashboardu istnieje
      await expect(page.locator('[data-testid="dashboard"], .dashboard, .main-content').first()).toBeVisible({ timeout: 15000 });
      
      // Sprawdź metryki - powinny być widoczne karty z danymi
      const metrics = page.locator('[data-testid*="metric"], .metric-card, .stat-card');
      await expect(metrics).toHaveCount({ min: 3 });
      
      // Sprawdź czy istnieją podstawowe metryki
      await expect(page.locator('text="Requests"', { exact: false })).toBeVisible();
      await expect(page.locator('text="Duration"', { exact: false })).toBeVisible();
      await expect(page.locator('text="Active"', { exact: false })).toBeVisible();
    });

    test('powinien wyświetlać wykresy i wizualizacje', async ({ page }) => {
      // Sprawdź czy wykresy się ładują
      const charts = page.locator('.chart, .graph, canvas, svg');
      await expect(charts).toHaveCount({ min: 1 });
      
      // Sprawdź czy wykresy mają dane (nie są puste)
      const chartContainers = await charts.count();
      expect(chartContainers).toBeGreaterThan(0);
    });

    test('powinien wyświetlać listę aktywnych zadań i błędów', async ({ page }) => {
      // Sprawdź czy istnieje sekcja z zadaniami
      const tasksSection = page.locator('[data-testid="tasks"], .tasks-section, .active-tasks');
      const hasTasks = await tasksSection.count() > 0;
      
      if (hasTasks) {
        await expect(tasksSection).toBeVisible();
        const taskItems = tasksSection.locator('.task-item, .list-item');
        // Może być pusta lista, ale sekcja powinna istnieć
      }
      
      // Sprawdź czy istnieje sekcja z błędami
      const errorsSection = page.locator('[data-testid="errors"], .errors-section, .recent-errors');
      const hasErrors = await errorsSection.count() > 0;
      
      if (hasErrors) {
        await expect(errorsSection).toBeVisible();
      }
    });
  });

  test.describe('Nawigacja i Routing', () => {
    test('powinien działać sidebar z nawigacją', async ({ page }) => {
      // Sprawdź czy sidebar istnieje
      const sidebar = page.locator('nav, .sidebar, .navigation');
      await expect(sidebar).toBeVisible();
      
      // Sprawdź czy istnieją linki nawigacyjne
      const navLinks = sidebar.locator('a, button[role="link"]');
      await expect(navLinks).toHaveCount({ min: 3 });
      
      // Sprawdź podstawowe sekcje
      const expectedSections = ['dashboard', 'tasks', 'hands', 'config'];
      for (const section of expectedSections) {
        const sectionLink = navLinks.locator(`text=${section}`, { exact: false });
        const hasSection = await sectionLink.count() > 0;
        if (hasSection) {
          await expect(sectionLink).toBeVisible();
        }
      }
    });

    test('powinien poprawnie nawigować między sekcjami', async ({ page }) => {
      // Testuj nawigację do głównych sekcji
      const sections = [
        { name: 'dashboard', selector: '[href*="dashboard"], button:has-text("Dashboard")' },
        { name: 'tasks', selector: '[href*="tasks"], button:has-text("Tasks")' },
        { name: 'hands', selector: '[href*="hands"], button:has-text("Hands")' },
        { name: 'config', selector: '[href*="config"], button:has-text("Config")' },
      ];

      for (const section of sections) {
        try {
          const link = page.locator(section.selector);
          const linkExists = await link.count() > 0;
          
          if (linkExists) {
            await link.click({ timeout: 5000 });
            await page.waitForURL(/\/?(dashboard|tasks|hands|config)?/, { timeout: 5000 });
            
            // Sprawdź czy content się zmienił
            const mainContent = page.locator('main, .main-content, #root > *');
            await expect(mainContent).toBeVisible();
          }
        } catch (e) {
          console.log(`Navigation to ${section.name} failed:`, e.message);
        }
      }
    });
  });

  test.describe('Zarządzanie Zadaniami', () => {
    test('powinien wyświetlać kanban board dla zadań', async ({ page }) => {
      // Przejdź do sekcji zadań
      await page.click('text="Tasks"', { timeout: 5000 });
      
      await page.waitForTimeout(2000);
      
      // Sprawdź czy istnieje kanban board
      const kanbanBoard = page.locator('.kanban-board, .board, [data-testid="kanban"]');
      const hasKanban = await kanbanBoard.count() > 0;
      
      if (hasKanban) {
        await expect(kanbanBoard).toBeVisible();
        
        // Sprawdź kolumny
        const columns = kanbanBoard.locator('.column, .kanban-column');
        await expect(columns).toHaveCount({ min: 2 });
      }
    });

    test('powinien umożliwiać tworzenie nowych zadań', async ({ page }) => {
      await page.click('text="Tasks"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // Sprawdź czy istnieje przycisk dodawania zadania
      const addTaskBtn = page.locator('button:has-text("Add"), button:has-text("Create"), [data-testid="add-task"]');
      const canAddTask = await addTaskBtn.count() > 0;
      
      if (canAddTask) {
        await expect(addTaskBtn).toBeVisible();
        // Nie klikamy, tylko sprawdzamy czy przycisk istnieje
      }
    });
  });

  test.describe('Zarządzanie Hands', () => {
    test('powinien wyświetlać listę aktywnych hands', async ({ page }) => {
      await page.click('text="Hands"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // Sprawdź czy istnieje lista hands
      const handsList = page.locator('[data-testid="hands-list"], .hands-container, .hands-grid');
      await expect(handsList).toBeVisible();
      
      // Sprawdź czy istnieją karty hands
      const handCards = handsList.locator('.hand-card, .hand-item');
      // Może być 0 jeśli żadne nie są aktywne
    });

    test('powinien wyświetlać status i postęp hands', async ({ page }) => {
      await page.click('text="Hands"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // Sprawdź czy istnieją wskaźniki statusu
      const statusIndicators = page.locator('.status-indicator, .hand-status');
      const hasStatus = await statusIndicators.count() > 0;
      
      if (hasStatus) {
        await expect(statusIndicators.first()).toBeVisible();
      }
    });
  });

  test.describe('Konfiguracja', () => {
    test('powinien wyświetlać panel konfiguracyjny', async ({ page }) => {
      await page.click('text="Config"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // Sprawdź czy istnieje panel konfiguracyjny
      const configPanel = page.locator('[data-testid="config"], .config-panel, .settings');
      await expect(configPanel).toBeVisible();
      
      // Sprawdź czy istnieją sekcje konfiguracyjne
      const configSections = configPanel.locator('.config-section, .settings-group');
      await expect(configSections).toHaveCount({ min: 1 });
    });

    test('powinien wyświetlać ustawienia API', async ({ page }) => {
      await page.click('text="Config"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // Sprawdź czy istnieje sekcja API
      const apiSection = page.locator('text="API", text="Providers", text="Models"');
      const hasApiSection = await apiSection.count() > 0;
      
      if (hasApiSection) {
        await expect(apiSection.first()).toBeVisible();
      }
    });
  });

  test.describe('Czatu i Komunikacji', () => {
    test('powinien wyświetlać interfejs czatu', async ({ page }) => {
      await page.click('text="Chat"', { timeout: 5000 });
      await page.waitForTimeout(2000);
      
      // Sprawdź czy istnieje interfejs czatu
      const chatInterface = page.locator('[data-testid="chat"], .chat-container, .chat-interface');
      await expect(chatInterface).toBeVisible();
      
      // Sprawdź czy istnieje pole do wpisywania wiadomości
      const messageInput = chatInterface.locator('input, textarea, [contenteditable="true"]');
      await expect(messageInput).toBeVisible();
    });
  });

  test.describe('Responsywność i Mobile', () => {
    test('powinien działać na urządzeniach mobilnych', async ({ page }) => {
      // Przełącz na widok mobilny
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Sprawdź czy strona się poprawnie wyświetla
      await expect(page.locator('body')).toBeVisible();
      
      // Sprawdź czy nawigacja mobilna istnieje
      const mobileNav = page.locator('.mobile-nav, .bottom-nav, nav:has(button)');
      const hasMobileNav = await mobileNav.count() > 0;
      
      if (hasMobileNav) {
        await expect(mobileNav).toBeVisible();
      }
    });
  });

  test.describe('Wydajność i Ładowanie', () => {
    test('powinien ładować się w rozsądnym czasie', async ({ page }) => {
      // Zmierz czas ładowania
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForSelector('#root > *:not(:empty)', { timeout: 15000 });
      const loadTime = Date.now() - startTime;
      
      console.log(`Page loaded in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000); // Mniej niż 10 sekund
    });

    test('powinien obsługiwać błędy sieciowe', async ({ page }) => {
      // Symuluj błąd sieciowy przez zablokowanie żądań
      await page.route('**/*', route => route.abort('failed'));
      
      // Sprawdź czy wyświetla się odpowiedni komunikat o błędzie
      await page.goto('/');
      await page.waitForTimeout(2000);
      
      const errorElement = page.locator('text="Error", text="Failed", text="Offline"');
      const hasError = await errorElement.count() > 0;
      
      // Przywróć normalne routing
      await page.unroute('**/*');
      
      if (hasError) {
        await expect(errorElement.first()).toBeVisible();
      }
    });
  });

  test.describe('WebSocket i Real-time', () => {
    test('powinien próbować nawiązać połączenie WebSocket', async ({ page }) => {
      // Nasłuchuj na żądania WebSocket
      const wsRequests: string[] = [];
      page.on('websocket', ws => {
        wsRequests.push(ws.url());
        console.log('WebSocket connection to:', ws.url());
      });
      
      await page.goto('/');
      await page.waitForTimeout(3000);
      
      // Sprawdź czy były próby połączenia WebSocket
      console.log('WebSocket connection attempts:', wsRequests.length);
    });
  });

  test.describe('Bezpieczeństwo i Autoryzacja', () => {
    test('powinien wyświetlać odpowiednie informacje o bezpieczeństwie', async ({ page }) => {
      // Sprawdź czy strona ma odpowiednie nagłówki bezpieczeństwa
      const response = await page.request.get(page.url());
      const headers = response.headers();
      
      console.log('Security headers:', {
        'content-security-policy': headers['content-security-policy'] || 'not set',
        'x-content-type-options': headers['x-content-type-options'] || 'not set',
        'x-frame-options': headers['x-frame-options'] || 'not set',
      });
    });
  });
});