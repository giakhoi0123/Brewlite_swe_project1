import type { NextFunction, Request, Response } from 'express';
/** Cookie-authenticated writes must come from the configured browser origin. */
export function cookieOriginGuard(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const allowed = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    const hasSession = request.headers.cookie?.includes('brewlite_session=');
    if (
      (request.headers.origin && request.headers.origin !== allowed) ||
      (hasSession && request.headers.origin !== allowed)
    ) {
      response
        .status(403)
        .json({
          statusCode: 403,
          message: 'Nguồn yêu cầu không hợp lệ',
          error: 'Forbidden',
        });
      return;
    }
  }
  next();
}
