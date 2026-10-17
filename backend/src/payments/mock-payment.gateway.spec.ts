import { afterEach, describe, expect, it } from '@jest/globals';
import { MockPaymentGateway } from './mock-payment.gateway';

describe('MockPaymentGateway sandbox controls', () => {
  const originalControls = process.env.PAYMENT_DEMO_CONTROLS;
  const originalOutcome = process.env.MOCK_PAYMENT_OUTCOME;
  const gateway = new MockPaymentGateway();

  afterEach(() => {
    if (originalControls === undefined) delete process.env.PAYMENT_DEMO_CONTROLS;
    else process.env.PAYMENT_DEMO_CONTROLS = originalControls;
    if (originalOutcome === undefined) delete process.env.MOCK_PAYMENT_OUTCOME;
    else process.env.MOCK_PAYMENT_OUTCOME = originalOutcome;
  });

  it('honors a per-request outcome only when sandbox controls are enabled', async () => {
    process.env.PAYMENT_DEMO_CONTROLS = 'true';
    await expect(
      gateway.charge({ demoOutcome: 'PAYMENT_FAILED' }),
    ).resolves.toBe('PAYMENT_FAILED');

    process.env.PAYMENT_DEMO_CONTROLS = 'false';
    process.env.MOCK_PAYMENT_OUTCOME = 'PAID';
    await expect(
      gateway.charge({ demoOutcome: 'PAYMENT_FAILED' }),
    ).resolves.toBe('PAID');
  });
});
