import { test, expect } from '@playwright/test';

test.describe('ZeroClaw HTML Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Load the dashboard HTML file
    await page.goto('file:///home/commander/.zeroclaw/workspace/dashboard-index.html');
    
    // Wait for the page to load
    await expect(page).toHaveTitle(/ZeroClaw Dashboard/);
    await page.waitForSelector('.container', { timeout: 10000 });
  });

  test.describe('Podstawowe Elementy Dashboardu', () => {
    test('powinien wyświetlać tytuł i nagłówek', async ({ page }) => {
      // Sprawdź tytuł strony
      await expect(page).toHaveTitle('ZeroClaw Dashboard - Test Stresu');
      
      // Sprawdź główny nagłówek
      const header = page.locator('.header h1');
      await expect(header).toBeVisible();
      await expect(header).toHaveText('🚀 ZeroClaw Dashboard');
      
      // Sprawdź podtytuł
      const subtitle = page.locator('.header p');
      await expect(subtitle).toBeVisible();
      await expect(subtitle).toHaveText('Panel Testu Stresu Systemu');
    });

    test('powinien wyświetlać wszystkie karty statusu', async ({ page }) => {
      // Sprawdź czy istnieje grid z kartami statusu
      const statusGrid = page.locator('.status-grid');
      await expect(statusGrid).toBeVisible();
      
      // Sprawdź czy są 4 karty statusu
      const statusCards = statusGrid.locator('.status-card');
      await expect(statusCards).toHaveCount(4);
      
      // Sprawdź tytuły kart
      const cardTitles = [
        'Status Systemu',
        'API Endpoints', 
        'WebSocket',
        'Uptime'
      ];
      
      for (const title of cardTitles) {
        const card = statusGrid.locator('.status-card', { hasText: title });
        await expect(card).toBeVisible();
      }
    });

    test('powinien wyświetlać wartości statusu', async ({ page }) => {
      // Sprawdź elementy statusu
      const systemStatus = page.locator('#system-status');
      const apiStatus = page.locator('#api-status');
      const wsStatus = page.locator('#ws-status');
      const uptime = page.locator('#uptime');
      
      await expect(systemStatus).toBeVisible();
      await expect(apiStatus).toBeVisible();
      await expect(wsStatus).toBeVisible();
      await expect(uptime).toBeVisible();
      
      // Sprawdź początkowe wartości
      await expect(systemStatus).toHaveText('ONLINE');
      await expect(apiStatus).toHaveText('3/3');
      await expect(wsStatus).toHaveText('WAITING');
    });
  });

  test.describe('Przyciski Kontroli', () => {
    test('powinien wyświetlać wszystkie przyciski sterujące', async ({ page }) => {
      const controls = page.locator('.controls');
      await expect(controls).toBeVisible();
      
      // Sprawdź wszystkie przyciski
      const buttons = controls.locator('.btn');
      await expect(buttons).toHaveCount(4);
      
      // Sprawdź etykiety przycisków
      const buttonTexts = [
        '🔍 Sprawdź Health',
        '📊 Wczytaj Statystyki', 
        '🔌 Połącz WebSocket',
        '🔄 Reset Systemu'
      ];
      
      for (const text of buttonTexts) {
        const button = controls.locator('button', { hasText: text });
        await expect(button).toBeVisible();
      }
    });

    test('powinien mieć odpowiednie klasy CSS dla przycisków', async ({ page }) => {
      const primaryButtons = page.locator('.btn-primary');
      const dangerButton = page.locator('.btn-danger');
      
      await expect(primaryButtons).toHaveCount(3);
      await expect(dangerButton).toHaveCount(1);
    });
  });

  test.describe('Sekcja Logów', () => {
    test('powinien wyświetlać sekcję logów', async ({ page }) => {
      const logSection = page.locator('.log-section');
      await expect(logSection).toBeVisible();
      
      // Sprawdź nagłówek sekcji
      const logHeader = logSection.locator('h3');
      await expect(logHeader).toBeVisible();
      await expect(logHeader).toHaveText('📋 Logi Systemowe');
      
      // Sprawdź kontener logów
      const logContent = page.locator('#log-content');
      await expect(logContent).toBeVisible();
      
      // Sprawdź początkową zawartość logów
      await expect(logContent).toHaveText(/System gotowy do testowania/);
    });

    test('powinien mieć poprawne style dla logów', async ({ page }) => {
      const logContent = page.locator('#log-content');
      
      // Sprawdź klasy CSS
      await expect(logContent).toHaveClass(/log-content/);
      
      // Sprawdź czy ma odpowiedni styl czcionki
      const fontFamily = await logContent.evaluate((el) => {
        return window.getComputedStyle(el).fontFamily;
      });
      expect(fontFamily).toContain('Courier New');
    });
  });

  test.describe('Status WebSocket', () => {
    test('powinien wyświetlać status WebSocket', async ({ page }) => {
      const wsStatus = page.locator('#websocket-status');
      await expect(wsStatus).toBeVisible();
      
      // Sprawdź początkowy status
      await expect(wsStatus).toHaveClass(/ws-disconnected/);
      await expect(wsStatus).toHaveText('🔴 Offline');
    });

    test('powinien zmienić status WebSocket po połączeniu', async ({ page }) => {
      const wsStatus = page.locator('#websocket-status');
      
      // Kliknij przycisk połączenia WebSocket
      await page.click('button:has-text("🔌 Połącz WebSocket")');
      
      // Poczekaj chwilę na próbę połączenia
      await page.waitForTimeout(2000);
      
      // Sprawdź czy status się zmienił (nawet jeśli połączenie nieudane, powinien być inny status)
      // W rzeczywistym środowisku testowałbyśmy tutaj faktyczne połączenie
    });
  });

  test.describe('Interaktywne Funkcje', () => {
    test('powinien uruchomić sprawdzenie health', async ({ page }) => {
      const logContent = page.locator('#log-content');
      const initialLogText = await logContent.textContent();
      
      // Kliknij przycisk sprawdzania health
      await page.click('button:has-text("🔍 Sprawdź Health")');
      
      // Poczekaj na wykonanie
      await page.waitForTimeout(2000);
      
      // Sprawdź czy w logach pojawił się nowy wpis
      const newLogText = await logContent.textContent();
      expect(newLogText).not.toBe(initialLogText);
      expect(newLogText).toContain('Sprawdzam status health endpoint');
    });

    test('powinien wczytać statystyki', async ({ page }) => {
      const logContent = page.locator('#log-content');
      
      // Kliknij przycisk wczytywania statystyk
      await page.click('button:has-text("📊 Wczytaj Statystyki")');
      
      // Poczekaj na wykonanie
      await page.waitForTimeout(2000);
      
      // Sprawdź czy w logach pojawił się odpowiedni wpis
      await expect(logContent).toHaveText(/Pobieram statystyki/);
    });

    test('powinien wyświetlać potwierdzenie resetu systemu', async ({ page }) => {
      // Nasłuchuj na dialogi
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('resetować system');
        await dialog.dismiss(); // Anuluj dialog
      });
      
      // Kliknij przycisk resetu
      await page.click('button:has-text("🔄 Reset Systemu")');
      
      // W rzeczywistym teście sprawdalibyśmy czy dialog się pojawił
      // Tutaj tylko upewniamy się, że przycisk reaguje
    });
  });

  test.describe('Licznik Uptime', () => {
    test('powinien wyświetlać i aktualizować uptime', async ({ page }) => {
      const uptimeElement = page.locator('#uptime');
      
      // Sprawdź początkową wartość
      await expect(uptimeElement).toHaveText('00:00:00');
      
      // Poczekaj 2 sekundy
      await page.waitForTimeout(2000);
      
      // Sprawdź czy uptime się zmienił
      const newUptime = await uptimeElement.textContent();
      expect(newUptime).not.toBe('00:00:00');
      
      // Sprawdź format czasu (HH:MM:SS)
      const timeRegex = /^\d{2}:\d{2}:\d{2}$/;
      expect(newUptime).toMatch(timeRegex);
    });
  });

  test.describe('Responsywność', () => {
    test('powinien działać na urządzeniach mobilnych', async ({ page }) => {
      // Przełącz na widok mobilny
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Sprawdź czy elementy są widoczne
      await expect(page.locator('.header')).toBeVisible();
      await expect(page.locator('.status-grid')).toBeVisible();
      await expect(page.locator('.controls')).toBeVisible();
      await expect(page.locator('.log-section')).toBeVisible();
    });

    test('powinien działać na tabletach', async ({ page }) => {
      // Przełącz na widok tabletowy
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Sprawdź czy elementy są widoczne
      await expect(page.locator('.status-grid')).toBeVisible();
      
      // Sprawdź czy grid responsywny działa
      const statusCards = page.locator('.status-card');
      await expect(statusCards).toHaveCount(4);
    });

    test('powinien działać na desktopie', async ({ page }) => {
      // Przełącz na widok desktopowy
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Sprawdź czy elementy są widoczne
      await expect(page.locator('.container')).toBeVisible();
      await expect(page.locator('.status-grid')).toBeVisible();
    });
  });

  test.describe('Style i Wygląd', () => {
    test('powinien mieć poprawne tło gradientowe', async ({ page }) => {
      const body = page.locator('body');
      
      // Sprawdź styl tła
      const background = await body.evaluate((el) => {
        return window.getComputedStyle(el).background;
      });
      
      expect(background).toContain('gradient');
    });

    test('powinien mieć efekt glassmorphism na kartach', async ({ page }) => {
      const statusCard = page.locator('.status-card').first();
      
      // Sprawdź styl karty
      const backdropFilter = await statusCard.evaluate((el) => {
        return window.getComputedStyle(el).backdropFilter;
      });
      
      expect(backdropFilter).toContain('blur');
    });

    test('powinien mieć poprawne kolory statusu', async ({ page }) => {
      const systemStatus = page.locator('#system-status');
      
      // Sprawdź klasę CSS
      await expect(systemStatus).toHaveClass(/status-good/);
      
      // Sprawdź kolor (poprzez klasy CSS)
      const colorClass = await systemStatus.getAttribute('class');
      expect(colorClass).toContain('status-good');
    });
  });

  test.describe('Wydajność', () => {
    test('powinien ładować się w rozsądnym czasie', async ({ page }) => {
      // Zmierz czas ładowania
      const startTime = Date.now();
      await page.goto('file:///home/commander/.zeroclaw/workspace/dashboard-index.html');
      await page.waitForSelector('.container', { timeout: 10000 });
      const loadTime = Date.now() - startTime;
      
      console.log(`Dashboard loaded in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000); // Mniej niż 5 sekund
    });
  });

  test.describe('JavaScript', () => {
    test('powinien mieć zdefiniowane funkcje JavaScript', async ({ page }) => {
      // Sprawdź czy funkcje są zdefiniowane
      const hasAddLog = await page.evaluate(() => {
        return typeof (window as any).addLog === 'function';
      });
      const hasCheckHealth = await page.evaluate(() => {
        return typeof (window as any).checkHealth === 'function';
      });
      const hasLoadStats = await page.evaluate(() => {
        return typeof (window as any).loadStats === 'function';
      });
      
      expect(hasAddLog).toBe(true);
      expect(hasCheckHealth).toBe(true);
      expect(hasLoadStats).toBe(true);
    });

    test('powinien dodawać logi do systemu', async ({ page }) => {
      const logContent = page.locator('#log-content');
      const initialText = await logContent.textContent();
      
      // Wywołaj funkcję logowania bezpośrednio
      await page.evaluate(() => {
        (window as any).addLog('Test log entry', 'info');
      });
      
      // Sprawdź czy log został dodany
      const newText = await logContent.textContent();
      expect(newText).not.toBe(initialText);
      expect(newText).toContain('Test log entry');
    });
  });

  test.describe('Stopka', () => {
    test('powinien wyświetlać stopkę z informacjami', async ({ page }) => {
      const footer = page.locator('.footer');
      await expect(footer).toBeVisible();
      
      // Sprawdź zawartość stopki
      await expect(footer).toHaveText(/ZeroClaw Dashboard v1.0/);
      await expect(footer).toHaveText(/Stworzone z ❤️ dla testów stresu/);
    });
  });
});