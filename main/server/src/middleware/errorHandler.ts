import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error("[Error]", err);
  res.status(500).json({ error: "Internal Server Error" });
}

