import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
const password = 'A' + randomUUID().replaceAll('-', '') + '9';
function staffCredentials() {
  const values = Object.fromEntries(readFileSync(resolve(__dirname, '../../.env'), 'utf8').split('\n').filter(x => x.includes('=')).map(x => { const [key,...rest]=x.split('='); return [key,rest.join('=').replace(/^"|"$/g,'')]; }));
  return {email:values.BARISTA_EMAIL,password:values.BARISTA_PASSWORD};
}
async function addCoffee(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('link',{name:/Tùy chỉnh Cà phê sữa đá Sài Gòn/}).click();
  await expect(page.getByRole('heading',{name:'Cà phê sữa đá Sài Gòn'})).toBeVisible();
  await page.getByRole('button',{name:/Size M/}).click();
  await page.getByRole('checkbox',{name:/Kem sữa/}).check();
  await page.getByRole('button',{name:'Tăng số lượng'}).click();
  await expect(page.getByText('126.000 ₫')).toBeVisible();
  await page.getByRole('button',{name:'Thêm vào giỏ hàng'}).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByLabel(/Giỏ hàng 2 món/)).toBeVisible();
}
async function addSeededCoffee(page: import('@playwright/test').Page) {
  await page.goto('/products/31a650c7-8597-4a01-a8e2-000000000001');
  await expect(page.getByRole('heading',{name:'Bạc xỉu 3 tầng Sài Gòn'})).toBeVisible();
  await page.getByRole('button',{name:'Thêm vào giỏ hàng'}).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByLabel(/Giỏ hàng 1 món/)).toBeVisible();
}
async function registerFromCheckout(page: import('@playwright/test').Page) {
  await page.getByRole('button',{name:/Tiến hành đặt hàng/}).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole('link',{name:'Đăng ký ngay'}).click();
  await page.getByLabel('Họ tên').fill('Khách kiểm thử');
  const email = 'e2e-'+randomUUID().slice(0,8)+'@example.test';
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu',{exact:true}).fill(password);
  await page.getByLabel('Xác nhận mật khẩu').fill(password);
  await page.getByRole('button',{name:'Đăng ký',exact:true}).click();
  await expect(page).toHaveURL(/\/checkout$/);
  return email;
}
test('checkout exposes only VNPAY-QR and completes the local payment flow', async ({page}) => {
  await addSeededCoffee(page);
  await registerFromCheckout(page);
  await expect(page.getByRole('radio',{name:/VNPAY-QR/})).toBeChecked();
  await expect(page.getByLabel('Kết quả thanh toán demo')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Ví điện tử'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Thẻ ngân hàng'})).toHaveCount(0);
  for (const viewport of [
    {width:1440,height:900},
    {width:768,height:1024},
    {width:390,height:844},
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('radio',{name:/VNPAY-QR/})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('button',{name:/Thanh toán qua VNPAY/}).click();
  await expect(page.getByRole('heading',{name:'Đặt hàng thành công!'})).toBeVisible();
  const orderId = new URL(page.url()).pathname.split('/')[2];
  await expect(page).toHaveURL(new RegExp(`/payment/${orderId}/success$`));
  await page.reload();
  await expect(page.getByRole('heading',{name:'Đặt hàng thành công!'})).toBeVisible();
  await expect(page.getByText('Phương thức: VNPAY-QR')).toBeVisible();
});
test('customer VNPAY success, loyalty and Barista workflow', async ({page}) => {
  test.slow();
  await addCoffee(page);
  await page.reload();
  await expect(page.getByLabel(/Giỏ hàng 2 món/)).toBeVisible();
  await page.getByRole('button',{name:'Tăng số lượng'}).click();
  await expect(page.getByLabel(/Giỏ hàng 3 món/)).toBeVisible();
  await expect(page.getByText('189.000 ₫').last()).toBeVisible();
  await page.getByRole('button',{name:'Giảm số lượng'}).click();
  await expect(page.getByLabel(/Giỏ hàng 2 món/)).toBeVisible();
  await expect(page.getByText('126.000 ₫').last()).toBeVisible();
  const customerEmail = await registerFromCheckout(page);
  await page.getByLabel('Mã ưu đãi').fill('KHONGHOPLE');
  await page.getByRole('button',{name:'Áp dụng'}).click();
  await expect(page.getByText('Mã ưu đãi không hợp lệ')).toBeVisible();
  await page.getByLabel('Mã ưu đãi').fill('BREW10');
  await page.getByRole('button',{name:'Áp dụng'}).click();
  await expect(page.getByText(/Đã áp dụng BREW10/)).toBeVisible();
  await expect(page.getByRole('radio',{name:/VNPAY-QR/})).toBeChecked();
  await page.getByRole('button',{name:/Thanh toán qua VNPAY/}).click();
  await expect(page.getByRole('heading',{name:'Đặt hàng thành công!'})).toBeVisible();
  const orderId = new URL(page.url()).pathname.split('/')[2];
  await expect(page).toHaveURL(new RegExp(`/payment/${orderId}/success$`));
  await expect(page.getByText('116.000 ₫')).toBeVisible();
  await expect(page.getByText('Phương thức: VNPAY-QR')).toBeVisible();
  await expect(page.getByLabel(/Giỏ hàng 0 món/)).toBeVisible();
  await page.goto('/orders');
  await expect(page.getByText(`Mã đơn #${orderId}`)).toBeVisible();
  await page.getByRole('link',{name:new RegExp(`Mã đơn #${orderId}`)}).click();
  await expect(page.locator('.timeline .done')).toHaveCount(2);
  await page.getByRole('button',{name:'Cập nhật trạng thái'}).click();
  await page.goto('/profile');
  await expect(page.getByText('11 điểm')).toBeVisible();
  await page.goto('/barista/dashboard');
  await expect(page).toHaveURL(/\/forbidden$/);
  await page.getByRole('button',{name:'Đăng xuất'}).click();
  await page.goto('/login');
  const staff = staffCredentials();
  await page.getByLabel('Email').fill(staff.email);
  await page.getByLabel('Mật khẩu').fill(staff.password);
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page).toHaveURL(/\/barista\/dashboard$/);
  page.on('dialog',d=>d.accept());
  await expect(page.getByText(`#${orderId}`)).toBeVisible();
  await page.getByRole('button',{name:'Bắt đầu pha chế'}).click();
  await page.getByRole('dialog',{name:'Xác nhận cập nhật đơn'}).getByRole('button',{name:'Xác nhận'}).click();
  await page.getByRole('button',{name:'Đã pha chế xong'}).click();
  await page.getByRole('dialog',{name:'Xác nhận cập nhật đơn'}).getByRole('button',{name:'Xác nhận'}).click();
  await page.getByRole('button',{name:'Xác nhận đã giao'}).click();
  await page.getByRole('dialog',{name:'Xác nhận cập nhật đơn'}).getByRole('button',{name:'Xác nhận'}).click();
  await expect(page.locator('.barista-ticket').filter({hasText:`#${orderId}`})).toHaveCount(0);
  await expect(page.getByText('Đã giao hôm nay').locator('..').getByText('1')).toBeVisible();
  await page.getByRole('link',{name:/Lịch sử xử lý/}).click();
  await expect(page.getByText(`#${orderId}`)).toBeVisible();
  await page.getByRole('button',{name:'Đăng xuất ca trực'}).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(customerEmail);
  await page.getByLabel('Mật khẩu').fill(password);
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page.getByRole('button',{name:'Đăng xuất',exact:true})).toBeVisible();
  await page.goto(`/orders/${orderId}`);
  await expect(page.locator('.status.COMPLETED')).toBeVisible();
});
test('cart remove and clear actions', async ({page}) => {
  await addCoffee(page);
  await page.goto('/');
  await page.getByRole('link',{name:/Tùy chỉnh Cà phê sữa đá Sài Gòn/}).click();
  await page.getByRole('button',{name:'Thêm vào giỏ hàng'}).click();
  await expect(page.locator('.cart-row')).toHaveCount(2);
  await expect(page.getByLabel(/Giỏ hàng 3 món/)).toBeVisible();
  await page.getByRole('button',{name:/Xóa Cà phê sữa đá Sài Gòn/}).first().click();
  await expect(page.locator('.cart-row')).toHaveCount(1);
  page.on('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Xóa tất cả'}).click();
  await expect(page.getByLabel(/Giỏ hàng 0 món/)).toBeVisible();
});
test('Barista cancellation requires a reason and moves the order to history', async ({page}) => {
  const id = `BL-${randomUUID().slice(0,8).toUpperCase()}`;
  await page.goto('/');
  await page.evaluate((orderId) => {
    const item = {key:'qa-line',productId:'ca-phe-sua',name:'Cà phê sữa đá',imageUrl:'',size:'M',toppingIds:[],toppingNames:[],unitPrice:45000,quantity:1,ice:'70% đá',sugar:'50% ít ngọt',note:'Ít đường'};
    const base = {userId:'qa-customer',items:[item],subtotal:45000,discount:0,total:45000,createdAt:new Date().toISOString()};
    localStorage.setItem('brewlite-demo-orders-v1',JSON.stringify([{...base,id:orderId,status:'PAID'},{...base,id:'BL-UNPAID',status:'PENDING'}]));
  }, id);
  const staff = staffCredentials();
  await page.goto('/login');
  await page.getByLabel('Email').fill(staff.email);
  await page.getByLabel('Mật khẩu').fill(staff.password);
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await expect(page).toHaveURL(/\/barista\/dashboard$/);
  await expect(page.locator('.barista-ticket').filter({hasText:id})).toBeVisible();
  await expect(page.locator('.barista-ticket').filter({hasText:'BL-UNPAID'})).toHaveCount(0);
  await page.locator('.barista-ticket').filter({hasText:id}).getByRole('button',{name:'Báo sự cố'}).click();
  const dialog = page.getByRole('dialog',{name:'Xác nhận cập nhật đơn'});
  await expect(dialog.getByRole('button',{name:'Xác nhận'})).toBeDisabled();
  await dialog.getByRole('textbox',{name:'Lý do hủy đơn'}).fill('Hết nguyên liệu');
  await dialog.getByRole('button',{name:'Xác nhận'}).click();
  await expect(page.locator('.barista-ticket').filter({hasText:id})).toHaveCount(0);
  await page.getByRole('link',{name:/Lịch sử xử lý/}).click();
  await expect(page.locator('.barista-ticket').filter({hasText:id})).toContainText('Hết nguyên liệu');
});
test('mobile search and VNPAY checkout remain responsive', async ({page}) => {
  test.slow();
  await page.setViewportSize({width:375,height:812});
  await page.goto('/');
  await expect(page.getByText('Tạm hết',{exact:true})).toBeVisible();
  await page.getByLabel('Tìm thức uống').fill('khong-co-mon-nay');
  await expect(page.getByText('Không tìm thấy thức uống phù hợp.')).toBeVisible();
  await page.getByRole('button',{name:'Xem tất cả đồ uống'}).click();
  await addCoffee(page);
  await registerFromCheckout(page);
  await expect(page.getByRole('radio',{name:/VNPAY-QR/})).toBeChecked();
  await expect(page.getByLabel('Kết quả thanh toán demo')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
