import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('auth recovery flow: forgot password sends email to Mailpit, reset password sets new password and can log in', async ({ page, request }) => {
  const email = `recovery-${randomUUID().slice(0, 8)}@example.test`;
  const initialPassword = 'Password123!';
  const newPassword = 'NewPassword456!';

  await page.goto('/register');
  await page.getByLabel('Họ tên').fill('Người Dùng Test');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(initialPassword);
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(initialPassword);
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page).toHaveURL(/\/(#menu)?$/);

  // Logout
  await page.getByRole('button', { name: 'Đăng xuất' }).click();

  // 2. Go to login page, click "Quên mật khẩu?"
  await page.goto('/login');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);

  // Fill forgot password form
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Gửi liên kết khôi phục' }).click();
  await expect(page.getByText(/hướng dẫn đặt lại mật khẩu đã được gửi/)).toBeVisible();

  // 3. Query Mailpit API to get reset token
  let resetToken = '';
  interface MailpitMessage {
    ID: string;
    To?: Array<{ Address: string }>;
  }
  for (let i = 0; i < 20; i++) {
    const res = await request.get('http://localhost:8025/api/v1/messages');
    const data = (await res.json()) as { messages?: MailpitMessage[] };
    const msg = data.messages?.find((m) => m.To?.some((t) => t.Address === email));
    if (msg) {
      const msgRes = await request.get(`http://localhost:8025/api/v1/message/${msg.ID}`);
      const msgData = await msgRes.json();
      const bodyText = msgData.Text || msgData.HTML || '';
      const match = bodyText.match(/token=([a-f0-9]+)/);
      if (match) {
        resetToken = match[1];
        break;
      }
    }
    await page.waitForTimeout(500);
  }

  expect(resetToken).toBeTruthy();

  // 4. Navigate to reset password page with token
  await page.goto(`/reset-password?token=${resetToken}`);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(newPassword);
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await expect(page.getByText('Đặt lại mật khẩu thành công!')).toBeVisible();

  // 5. Login with new password
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/(#menu)?$/);
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();

  // 6. Go to profile and test Change Password
  await page.goto('/profile');
  await expect(page.getByText('Đổi mật khẩu')).toBeVisible();
  const evenNewerPassword = 'EvenNewerPassword789!';
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(newPassword);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(evenNewerPassword);
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill(evenNewerPassword);
  await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
  await expect(page.getByText(/Đổi mật khẩu thành công/)).toBeVisible();
});
