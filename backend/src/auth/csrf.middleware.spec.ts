import { cookieOriginGuard } from './csrf.middleware';
import type { NextFunction, Request, Response } from 'express';
import { jest } from '@jest/globals';
describe('cookie origin guard', () => {
  const run = (method: string, cookie?: string, origin?: string) => {
    const next = jest.fn() as NextFunction;
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    cookieOriginGuard(
      { method, headers: { cookie, origin } } as Request,
      { status } as unknown as Response,
      next,
    );
    return { next, status, json };
  };
  it('rejects cross-origin and missing-origin cookie writes', () => {
    expect(
      run('POST', 'brewlite_session=abc', 'https://other.test').status,
    ).toHaveBeenCalledWith(403);
    expect(run('PATCH', 'brewlite_session=abc').status).toHaveBeenCalledWith(
      403,
    );
    expect(
      run('POST', undefined, 'https://other.test').status,
    ).toHaveBeenCalledWith(403);
  });
  it('allows same-origin cookie writes, reads and bearer-only clients', () => {
    expect(
      run('POST', 'brewlite_session=abc', 'http://localhost:3000').next,
    ).toHaveBeenCalled();
    expect(run('GET', 'brewlite_session=abc').next).toHaveBeenCalled();
    expect(run('POST').next).toHaveBeenCalled();
  });
});
