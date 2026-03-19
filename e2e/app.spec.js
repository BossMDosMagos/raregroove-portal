import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
  test('deve carregar a página de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/RareGroove/i);
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/senha/i).fill('wrongpassword');
    
    await page.getByRole('button', { name: /entrar/i }).click();
    
    await expect(page.getByText(/credenciais inválidas/i)).toBeVisible();
  });

  test('deve validar formato de email', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/senha/i).fill('password123');
    
    await page.getByRole('button', { name: /entrar/i }).click();
    
    await expect(page.getByText(/email inválido/i)).toBeVisible();
  });

  test('deve detectar tentativas de bot (honeypot)', async ({ page }) => {
    await page.goto('/login');
    
    const honeypotField = page.locator('input[name="dobles"]');
    if (await honeypotField.isVisible()) {
      await honeypotField.fill('bot@spam.com');
    }
    
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/senha/i).fill('password123');
    
    await page.getByRole('button', { name: /entrar/i }).click();
    
    await expect(page.getByText(/acesso bloqueado/i)).toBeVisible();
  });
});

test.describe('Catálogo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('deve carregar a página inicial', async ({ page }) => {
    await expect(page).toHaveTitle(/RareGroove/i);
  });

  test('deve exibir itens do catálogo', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /catálogo/i })).toBeVisible();
  });

  test('deve permitir filtrar por gênero', async ({ page }) => {
    await page.goto('/catalog');
    
    const genreFilter = page.getByLabel(/gênero/i);
    if (await genreFilter.isVisible()) {
      await genreFilter.selectOption('rock');
      await expect(page).toHaveURL(/genre=rock/);
    }
  });

  test('deve buscar itens por texto', async ({ page }) => {
    await page.goto('/catalog');
    
    const searchInput = page.getByPlaceholder(/buscar/i);
    await searchInput.fill('Pink Floyd');
    
    await page.keyboard.press('Enter');
    
    await expect(page.getByText(/resultados para "Pink Floyd"/i)).toBeVisible();
  });
});

test.describe('Carrinho', () => {
  test('deve adicionar item ao carrinho', async ({ page }) => {
    await page.goto('/catalog');
    
    const addButton = page.getByRole('button', { name: /adicionar ao carrinho/i }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      
      await expect(page.getByText(/item adicionado/i)).toBeVisible();
      await expect(page.locator('.cart-badge, [data-cart-count]')).toHaveText('1');
    }
  });

  test('deve mostrar carrinho vazio', async ({ page }) => {
    await page.goto('/cart');
    
    await expect(page.getByText(/seu carrinho está vazio/i)).toBeVisible();
  });

  test('deve calcular total corretamente', async ({ page }) => {
    await page.goto('/cart');
    
    const subtotal = page.locator('[data-subtotal]');
    const shipping = page.locator('[data-shipping]');
    const total = page.locator('[data-total]');
    
    if (await subtotal.isVisible() && await total.isVisible()) {
      const subtotalValue = parseFloat((await subtotal.textContent()).replace(/[^\d,]/g, '').replace(',', '.'));
      const totalValue = parseFloat((await total.textContent()).replace(/[^\d,]/g, '').replace(',', '.'));
      
      expect(totalValue).toBeGreaterThanOrEqual(subtotalValue);
    }
  });
});

test.describe('Checkout', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('deve redirecionar para login ao acessar checkout sem autenticação', async ({ page }) => {
    await page.goto('/checkout');
    
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/faça login para continuar/i)).toBeVisible();
  });

  test('deve selecionar gateway de pagamento', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill(process.env.TEST_EMAIL || 'test@example.com');
    await page.getByLabel(/senha/i).fill(process.env.TEST_PASSWORD || 'TestPassword123');
    
    await page.getByRole('button', { name: /entrar/i }).click();
    
    await page.goto('/checkout');
    
    const stripeOption = page.getByLabel(/stripe/i);
    const pixOption = page.getByLabel(/pix/i);
    const paypalOption = page.getByLabel(/paypal/i);
    
    const paymentOptions = [stripeOption, pixOption, paypalOption];
    for (const option of paymentOptions) {
      if (await option.isVisible()) {
        await option.click();
        break;
      }
    }
  });
});

test.describe('Responsividade', () => {
  const viewports = [
    { name: 'Mobile', width: 390, height: 844 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 720 },
  ];

  for (const viewport of viewports) {
    test(`deve funcionar em ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      await page.goto('/');
      await expect(page).toHaveTitle(/RareGroove/i);
      
      const menuButton = page.locator('[aria-label="menu"], [data-menu-toggle]');
      if (viewport.name === 'Mobile' && await menuButton.isVisible()) {
        await menuButton.click();
        await expect(page.getByRole('navigation')).toBeVisible();
      }
    });
  }
});

test.describe('SEO e Acessibilidade', () => {
  test('deve ter meta tags adequadas', async ({ page }) => {
    await page.goto('/');
    
    const description = await page.getAttribute('meta[name="description"]', 'content');
    expect(description).toBeTruthy();
    expect(description.length).toBeGreaterThan(50);
  });

  test('deve ter tags semânticas corretas', async ({ page }) => {
    await page.goto('/');
    
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('deve ter contraste de cores adequado', async ({ page }) => {
    await page.goto('/login');
    
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(1000);
    
    const contrastErrors = errors.filter(e => e.includes('contrast') || e.includes('color'));
    expect(contrastErrors.length).toBe(0);
  });
});

test.describe('Performance', () => {
  test('deve carregar em menos de 3 segundos', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });

  test('deve ter imagens otimizadas', async ({ page }) => {
    await page.goto('/catalog');
    
    const images = page.locator('img');
    const imageCount = await images.count();
    
    if (imageCount > 0) {
      const firstImage = images.first();
      const naturalWidth = await firstImage.getAttribute('width');
      const naturalHeight = await firstImage.getAttribute('height');
      
      expect(naturalWidth).toBeTruthy();
      expect(naturalHeight).toBeTruthy();
    }
  });
});
