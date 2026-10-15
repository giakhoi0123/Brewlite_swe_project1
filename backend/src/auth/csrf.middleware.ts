import type { NextFunction, Request, Response } from 'express';
import { allowedFrontendOrigins } from '../configuration';
/** Cookie-authenticated writes must come from the configured browser origin. */
export function cookieOriginGuard(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const allowed = allowedFrontendOrigins();
    const validOrigin = Boolean(
      request.headers.origin && allowed.includes(request.headers.origin),
    );
    const hasSession = request.headers.cookie?.includes('brewlite_session=');
    if (
      (request.headers.origin && !validOrigin) ||
      (hasSession && !validOrigin)
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
