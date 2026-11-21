const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Défense supplémentaire : aucun appel sortant vers un service de production.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto('/test-pwa.html');
});

test('version isolée identifiable et aucun paiement réel', async ({ page }) => {
  await expect(page.locator('body')).toContainText('MODE TEST — AUCUN PAIEMENT RÉEL');
  await expect(page.locator('h1').first()).toContainText('CYRNEA ASSISTANT');
  await expect(page.getByRole('button', { name: /NOUVELLE MISSION/ })).toBeVisible();
});

test('nouvelle mission ouvre le parcours sans appel externe', async ({ page }) => {
  await page.getByRole('button', { name: /NOUVELLE MISSION/ }).click();
  await expect(page.locator('main#app')).not.toBeEmpty();
  await expect(page.locator('body')).toContainText('MODE TEST — AUCUN PAIEMENT RÉEL');
});

test('version production présente dans le dépôt, sans exécution de ses appels externes', async ({ request }) => {
  const response = await request.get('/index.html');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('CYRNEA ASSISTANT');
  expect(html).toContain('cyrnea-payment-gateway');
  expect(html).toContain('RELAIS');
  expect(html).toContain('B2B');
});
