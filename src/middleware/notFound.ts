import { Request, Response, NextFunction } from "express";

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
};
