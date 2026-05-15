import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation";

export const { withEvlog, useLogger, log, createError } = createEvlog({
  service: "struxav2-web",
});

export const { register, onRequestError } = createInstrumentation({
  service: "struxav2-web",
});
