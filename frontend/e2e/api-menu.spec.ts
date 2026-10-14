import { test, expect } from '@playwright/test';
test.skip(!process.env.BREWLITE_RUN_API_E2E, 'Chạy riêng khi frontend ở NEXT_PUBLIC_DATA_MODE=api');
test('API mode menu and customization consume PostgreSQL Products API', async ({page,request}) => {
  await page.goto('/');
  await expect(page.getByText('Chế độ demo:')).toHaveCount(0);
  await expect(page.locator('.product-card')).toHaveCount(10);
  const first = page.locator('.product-card').first();
  const href = await first.getByRole('link',{name:/Tùy chỉnh/}).getAttribute('href');
  const name = await first.locator('h3').textContent();
  expect(href).toBeTruthy();
  const response = await request.get('http://localhost:3001/api'+href);
  expect(response.ok()).toBeTruthy();
  const product = await response.json() as {price:number;sizes:{code:string;extraPrice:number}[];toppings:{id:string;name:string;extraPrice:number;available:boolean}[]};
  await first.getByRole('link',{name:/Tùy chỉnh/}).click();
  await expect(page.getByRole('heading',{name:name||''})).toBeVisible();
  for (const code of ['S','M','L']) await expect(page.getByRole('button',{name:new RegExp(`^${code} ·`)})).toBeVisible();
  for (const code of ['S','L','M']) {
    await page.getByRole('button',{name:new RegExp(`^${code} ·`)}).click();
    const sizePrice=product.price+(product.sizes.find(s=>s.code===code)?.extraPrice||0);
    await expect(page.getByText(new Intl.NumberFormat('vi-VN').format(sizePrice)+' ₫').last()).toBeVisible();
  }
  const topping=product.toppings.find(t=>t.available);
  if(topping) await page.getByRole('checkbox',{name:new RegExp(topping.name)}).check();
  const expected=product.price+(product.sizes.find(s=>s.code==='M')?.extraPrice||0)+(topping?.extraPrice||0);
  await expect(page.getByText(new Intl.NumberFormat('vi-VN').format(expected)+' ₫').last()).toBeVisible();
  await page.getByRole('button',{name:'Thêm vào giỏ hàng'}).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText(name||'',{exact:true})).toBeVisible();
});
test('API mode menu handles loading, empty, error and retry', async ({page}) => {
  let state:'empty'|'error'|'real'='empty';
  await page.route('**/api/products',async route=>{
    if(state==='real') return route.continue();
    await new Promise(resolve=>setTimeout(resolve,500));
    await route.fulfill({status:state==='empty'?200:500,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://localhost:3000','Access-Control-Allow-Credentials':'true'},body:state==='empty'?'[]':'{"message":"API demo error"}'});
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByText('Không tìm thấy thức uống phù hợp.')).toBeVisible();
  state='error';
  await page.reload();
  await expect(page.locator('.panel[role="alert"]')).toContainText('API demo error');
  state='real';
  await page.getByRole('button',{name:'Thử lại'}).click();
  await expect(page.locator('.product-card')).toHaveCount(10);
});
