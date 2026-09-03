import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

// Single error handler: ZodError -> 400, otherwise use err.status or 500.
// Never leak a stack trace or a raw message on a 500.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ code: "VALIDATION", message: "Invalid input", details: err.issues });
    return;
  }
  const status = typeof err?.status === "number" ? err.status : 500;
  if (status >= 500) {
    req.log?.error?.({ err }, "unhandled error");
    res.status(status).json({ code: err?.code ?? "INTERNAL", message: "Internal error" });
    return;
  }
  res.status(status).json({ code: err?.code ?? "ERROR", message: String(err?.message ?? "Error") });
};
