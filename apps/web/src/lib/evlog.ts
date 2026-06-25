import { createEvlog } from "evlog/next";
import { defineNodeInstrumentation } from "evlog/next/instrumentation";

export const { withEvlog, useLogger, log, createError } = createEvlog({
  service: "struxav2-web",
});

export const { register, onRequestError } = defineNodeInstrumentation({
  service: "struxav2-web",
});
