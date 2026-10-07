// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

// h3's HTTPError serializes to {"status":500,"unhandled":true,"message":"HTTPError"} —
// no stack, no cause — so a plain console.error(error) reaches the log pipeline with
// the failure detail stripped. Expand Error-like args into a string that keeps the
// message, stack, and the full cause chain.
const CAUSE_DEPTH_LIMIT = 5;
const DESCRIPTION_LENGTH_LIMIT = 8_000;

export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth++) {
    if (!(current instanceof Error)) {
      parts.push(typeof current === "string" ? current : safeStringify(current));
      break;
    }
    const label = depth === 0 ? "" : "caused by: ";
    const status = describeStatus(current);
    parts.push(`${label}${current.stack ?? `${current.name}: ${current.message}`}${status}`);
    current = current.cause;
  }
  return parts.join("\n").slice(0, DESCRIPTION_LENGTH_LIMIT);
}

function describeStatus(error: Error): string {
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = status ?? statusCode;
  return typeof value === "number" ? ` (status ${value})` : "";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

// A browser that drops an in-flight request (fast navigation, reload, closed
// tab, editor restart) surfaces in Node's HTTP layer as `Error: aborted` and is
// logged by h3 as a 500. No app code is involved, so it must not be recorded as
// the app's own failure — but it stays visible in the log as a warning.
const CLIENT_ABORT_MESSAGE =
  /^(?:aborted|connection (?:closed|reset|aborted)|socket hang up|terminated)$/i;
const TRANSPORT_FRAME =
  /node:_(?:http_server|net)|node:internal\/(?:http|streams)|abortIncoming|socketOnClose|writerd/i;

function isClientAbort(error: Error): boolean {
  // server.ts re-throws the failure with its own frame on top, so the abort is
  // commonly one level down in the cause chain.
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && isErrorLike(current); depth++) {
    const err = current as Error;
    if (err.name === "AbortError") return true;
    if (CLIENT_ABORT_MESSAGE.test(err.message) && TRANSPORT_FRAME.test(err.stack ?? "")) {
      return true;
    }
    current = err.cause;
  }
  return false;
}

function findClientAbort(args: unknown[]): Error | undefined {
  return args.find((arg): arg is Error => isErrorLike(arg) && isClientAbort(arg));
}

// Wrap console.error so errors logged by any layer — including h3's internal
// unhandled-error logging, which this file cannot hook directly — are both
// recorded for consumeLastCapturedError and expanded before serialization.
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
console.error = (...args: unknown[]) => {
  const aborted = findClientAbort(args);
  if (aborted) {
    originalConsoleWarn(`[client-abort] ${describeError(aborted)}`);
    return;
  }
  const expanded = args.map((arg) => {
    if (!isErrorLike(arg)) return arg;
    record(arg);
    return describeError(arg);
  });
  originalConsoleError(...expanded);
};

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
