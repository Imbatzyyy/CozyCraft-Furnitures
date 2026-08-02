type FunctionErrorLike = {
  message?: unknown;
  context?: unknown;
};

function payloadMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as { error?: unknown; message?: unknown };
  if (typeof candidate.error === "string" && candidate.error.trim()) {
    return candidate.error.trim();
  }
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message.trim();
  }
  return null;
}

export async function functionErrorMessage(
  error: unknown,
  fallback: string,
) {
  const functionError = error as FunctionErrorLike | null;
  const response = functionError?.context;

  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      const message = payloadMessage(body);
      if (message) return message;
    } catch {
      try {
        const message = (await response.clone().text()).trim();
        if (message) return message;
      } catch {
        // The response body is optional; fall through to the regular message.
      }
    }
  }

  const message =
    typeof functionError?.message === "string"
      ? functionError.message.trim()
      : "";
  return message && message !== "Edge Function returned a non-2xx status code"
    ? message
    : fallback;
}

export function isHandledFunctionResponse(error: unknown) {
  return (error as FunctionErrorLike | null)?.context instanceof Response;
}
