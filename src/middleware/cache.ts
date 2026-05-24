import { Request, Response, NextFunction } from "express";

/**
 * Middleware для установки заголовков кеширования
 */
export const cacheControl = (maxAge: number = 1) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
    res.setHeader(
      "Expires",
      new Date(Date.now() + maxAge * 1000).toUTCString(),
    );
    next();
  };
};
