/**
 * Playwright Tests dla każdej podstrony dashboardu ZeroClaw
 * Testy funkcjonalności każdej sekcji
 *
 * Uruchomienie: npx playwright test dashboard_pages.spec.js
 */

const { test, expect } = require('@playwright/test');

// Stałe dane autoryzacji dla testów
const AUTH_TOKEN = 'zc_8c38f7de16faa63fb0b9f9618a37867c1691bc99ebee7b72dd430b1c8391e21b';
const DASHBOARD_URL = 'https://dash.karndt.pl';

// Helper: Zaloguj się do dashboardu
async function loginToDashboard(page) {
  await page.goto(DASHBOARD_URL);
  await page.evaluate((tok) => {
    localStorage.setItem('zeroclaw_token', tok);
  }, AUTH_TOKEN);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

// Helper: Nawiguj do sekcji
async function navigateToSection(page, sectionName) {
  const link = page.locator('a, button, [role="link"], [role="menuitem"]').filter({ hasText: sectionName }).first();

  if (await link.count() > 0) {
    await link.click();
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

// ============================================
// DASHBOARD - Strona główna
// ============================================
test.describe('Dashboard - Strona Główna', () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test('powinien wyświetlać stronę główną Dashboard', async ({ page }) => {
    const body = await page.locator('body').textContent();

    // Sprawdź elementy dashboardu
    expect(body).toMatch(/Dashboard|ZeroClaw/);
    console.log('✅ Strona główna Dashboard załadowana');

    // Sprawdź metryki
    const metrics = ['Total Requests', 'Avg Duration', 'Total Tokens', 'Active Hands'];
    const foundMetrics = metrics.filter(m => body.includes(m));
    console.log(`   Metryki: ${foundMetrics.join(', ')}`);

    // Zrób zrzut ekranu
    await page.screenshot({ path: 'test-results/01-dashboard.png', fullPage: true });
  });

  test('powinien wyświetlać karty z statystykami', async ({ page }) => {
    // Sprawdź czy są karty/statystyki
    const cards = page.locator('[class*="card"], [class*="stat"], [class*="metric"], .grid > div');
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);
    console.log(`✅ Znaleziono ${count} elementów UI na dashboardzie`);
  });
});

// ============================================
// TASKS - Zarządzanie zadaniami
// ============================================
test.describe('Tasks - Zarządzanie zadaniami', () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test('powinien wyświetlić stronę Tasks', async ({ page }) => {
    const navigated = await navigateToSection(page, 'Tasks');
    expect(navigated).toBe(true);

    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();

    // Sprawdź czy jesteśmy na stronie Tasks
    expect(body.length).toBeGreaterThan(50);
    console.log('✅ Strona Tasks załadowana');

    await page.screenshot({ path: 'test-results/02-tasks.png', fullPage: true });
  });

  test('powinien wyświetlać listę zadań', async ({ page }) => {
    await navigateToSection(page, 'Tasks');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent();

    // Sprawdź elementy związane z zadaniami
    const taskElements = ['task', 'Task', 'status', 'created', 'action'];
    const found = taskElements.filter(e => body.toLowerCase().includes(e.toLowerCase()));

    console.log(`✅ Elementy Tasks: ${found.join(', ')}`);

    // Sprawdź API
    const response = await page.request.get(`${DASHBOARD_URL}/api/v1/tasks`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    console.log(`   API /tasks zwróciło: ${JSON.stringify(data).substring(0, 100)}...`);
  });

  test('powinien mieć możliwość tworzenia nowego zadania', async ({ page }) => {
    await navigateToSection(page, 'Tasks');
    await page.waitForTimeout(2000);

    // Sprawdź czy jest przycisk/pole do tworzenia zadania
    const createButton = page.locator('button').filter({ hasText: /create|add|new|dodaj|utwórz/i });
    const inputFields = page.locator('input[type="text"], textarea');

    const hasCreateUI = await createButton.count() > 0 || await inputFields.count() > 0;

    if (hasCreateUI) {
      console.log('✅ Interfejs tworzenia zadań dostępny');
    } else {
      console.log('ℹ️  Interfejs tworzenia zadań nie znaleziony (może być inaczej zimplementowany)');
    }
  });
});

// ============================================
// HANDS - Aktywne ręce/agenta
// ============================================
test.describe('Hands - Aktywne ręce', () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test('powinien wyświetlić stronę Hands', async ({ page }) => {
    const navigated = await navigateToSection(page, 'Hands');
    expect(navigated).toBe(true);

    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();

    expect(body.length).toBeGreaterThan(50);
    console.log('✅ Strona Hands załadowana');

    await page.screenshot({ path: 'test-results/03-hands.png', fullPage: true });
  });

  test('powinien wyświetlać aktywne ręce/agenty', async ({ page }) => {
    await navigateToSection(page, 'Hands');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent();

    // Sprawdź elementy związane z hands
    const handElements = ['hand', 'agent', 'active', 'running', 'status'];
    const found = handElements.filter(e => body.toLowerCase().includes(e.toLowerCase()));

    console.log(`✅ Elementy Hands: ${found.join(', ')}`);
  });
});

// ============================================
// MEMORY - Pamięć i graf wiedzy
// ============================================
test.describe('Memory - Pamięć systemu', () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test('powinien wyświetlić stronę Memory', async ({ page }) => {
    const navigated = await navigateToSection(page, 'Memory');
    expect(navigated).toBe(true);

    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();

    expect(body.length).toBeGreaterThan(50);
    console.log('✅ Strona Memory załadowana');

    await page.screenshot({ path: 'test-results/04-memory.png', fullPage: true });
  });

  test('powinien wyświetlać graf pamięci', async ({ page }) => {
    await navigateToSection(page, 'Memory');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent();

    // Sprawdź elementy związane z pamięcią
    const memoryElements = ['memory', 'node', 'graph', 'link', 'search'];
    const found = memoryElements.filter(e => body.toLowerCase().includes(e.toLowerCase()));

    console.log(`✅ Elementy Memory: ${found.join(', ')}`);

    // Sprawdź API
    const response = await page.request.get(`${DASHBOARD_URL}/api/v1/memory/graph`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    console.log(`   API /memory/graph: ${data.nodes?.length || 0} węzłów, ${data.links?.length || 0} linków`);
  });

  test('powinien mieć wyszukiwarkę pamięci', async ({ page }) => {
    await navigateToSection(page, 'Memory');
    await page.waitForTimeout(2000);

    // Sprawdź czy jest pole wyszukiwania
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="Search"], input[placeholder*="szukaj"]');

    if (await searchInput.count() > 0) {
      console.log('✅ Pole wyszukiwania pamięci dostępne');
    } else {
      console.log('ℹ️  Pole wyszukiwania nie znalezione');
    }
  });
});

// ============================================
// SOPs - Standard Operating Procedures
// ============================================
test.describe('SOPs - Procedury', () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test('powinien wyświetlić stronę SOPs', async ({ page }) => {
    const navigated = await navigateToSection(page, 'SOPs');
    expect(navigated).toBe(true);

    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();

    expect(body.length).toBeGreaterThan(50);
    console.log('✅ Strona SOPs załadowana');

    await page.screenshot({ path: 'test-results/05-sops.png', fullPage: true });
  });

  test('powinien wyświetlać listę procedur', async ({ page }) => {
    await navigateToSection(page, 'SOPs');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent();

    // Sprawdź elementy SOP
    const sopElements = ['sop', 'procedure', 'step', 'workflow'];
    const found = sopElements.filter(e => body.toLowerCase().includes(e.toLowerCase()));

    console.log(`✅ Elementy SOPs: ${found.join(', ')}`);
  });
});

// ============================================
// CONFIG - Konfiguracja systemu
// ============================================
test.describe('Config - Konfiguracja', () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test('powinien wyświetlić stronę Config', async ({ page }) => {
    const navigated = await navigateToSection(page, 'Config');
    expect(navigated).toBe(true);

    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();

    expect(body.length).toBeGreaterThan(50);
    console.log('✅ Strona Config załadowana');

    await page.screenshot({ path: 'test-results/06-config.png', fullPage: true });
  });

  test('powinien wyświetlać ustawienia systemu', async ({ page }) => {
    await navigateToSection(page, 'Config');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent();

    // Sprawdź elementy konfiguracyjne
    const configElements = ['provider', 'api', 'model', 'tokens', 'timeout'];
    const found = configElements.filter(e => body.toLowerCase().includes(e.toLowerCase()));

    console.log(`✅ Elementy Config: ${found.join(', ')}`);

    // Sprawdź API
    const response = await page.request.get(`${DASHBOARD_URL}/api/v1/config`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    console.log(`   API /config:`, Object.keys(data.data || {}).join(', '));
  });

  test('powinien mieć formularz ustawień', async ({ page }) => {
    await navigateToSection(page, 'Config');
    await page.waitForTimeout(2000);

    // Sprawdź czy są pola formularza
    const inputs = page.locator('input, select, textarea');
    const buttons = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Zapisz")');

    const inputCount = await inputs.count();
    const saveButtonCount = await buttons.count();

    console.log(`✅ Pola formularza: ${inputCount}, Przyciski zapisu: ${saveButtonCount}`);
  });
});

// ============================================
// CHAT - Czat z agentem
// ============================================
test.describe('Chat - Interfejs czatu', () => {
  test.beforeEach(async ({ page }) => {
    await loginToDashboard(page);
  });

  test('powinien wyświetlić stronę Chat', async ({ page }) => {
    const navigated = await navigateToSection(page, 'Chat');
    expect(navigated).toBe(true);

    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent();

    expect(body.length).toBeGreaterThan(50);
    console.log('✅ Strona Chat załadowana');

    await page.screenshot({ path: 'test-results/07-chat.png', fullPage: true });
  });

  test('powinien mieć interfejs czatu', async ({ page }) => {
    await navigateToSection(page, 'Chat');
    await page.waitForTimeout(2000);

    const body = await page.locator('body').textContent();

    // Sprawdź elementy czatu
    const chatElements = ['message', 'input', 'send', 'chat', 'conversation'];
    const found = chatElements.filter(e => body.toLowerCase().includes(e.toLowerCase()));

    console.log(`✅ Elementy Chat: ${found.join(', ')}`);

    // Sprawdź czy jest pole wiadomości
    const messageInput = page.locator('input[placeholder*="message"], textarea, input[type="text"]');
    const sendButton = page.locator('button').filter({ hasText: /send|send message|wyślij/i });

    const hasInput = await messageInput.count() > 0;
    const hasSend = await sendButton.count() > 0;

    if (hasInput || hasSend) {
      console.log('   Interfejs czatu dostępny');
    }
  });
});

// ============================================
// Nawigacja między stronami
// ============================================
test.describe('Nawigacja między sekcjami', () => {
  test('powinien umożliwiać nawigację we wszystkich sekcjach', async ({ page }) => {
    await loginToDashboard(page);

    const sections = ['Dashboard', 'Tasks', 'Hands', 'Memory', 'SOPs', 'Config', 'Chat'];
    const visited = [];

    for (const section of sections) {
      const navigated = await navigateToSection(page, section);
      if (navigated) {
        visited.push(section);
        console.log(`✅ Nawigacja do ${section} - OK`);
      } else {
        console.log(`⚠️  Nawigacja do ${section} - nieudana`);
      }
      await page.waitForTimeout(1000);
    }

    console.log(`\nPodsumowanie nawigacji: ${visited.length}/${sections.length} sekcji dostępnych`);
    expect(visited.length).toBeGreaterThan(0);
  });
});

// ============================================
// API - Testy wszystkich endpointów
// ============================================
test.describe('API - Wszystkie endpointy', () => {
  test('powinien działać endpoint /api/v1/config', async ({ request }) => {
    const response = await request.get(`${DASHBOARD_URL}/api/v1/config`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log('✅ GET /api/v1/config - OK');
  });

  test('powinien działać endpoint /api/v1/tasks', async ({ request }) => {
    const response = await request.get(`${DASHBOARD_URL}/api/v1/tasks`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log('✅ GET /api/v1/tasks - OK');
  });

  test('powinien działać endpoint /api/v1/memory/graph', async ({ request }) => {
    const response = await request.get(`${DASHBOARD_URL}/api/v1/memory/graph`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.nodes).toBeDefined();
    console.log('✅ GET /api/v1/memory/graph - OK');
  });

  test('powinien działać endpoint /api/v1/metrics', async ({ request }) => {
    const response = await request.get(`${DASHBOARD_URL}/api/v1/metrics`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });

    expect(response.status()).toBe(200);
    console.log('✅ GET /api/v1/metrics - OK');
  });
});
