/**
 * Fetch with timeout — wraps native fetch with AbortController
 * so requests don't hang indefinitely on slow/dead servers.
 * If options.signal is provided, the request can also be aborted externally.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  // If caller provides an external signal, forward its abort to our controller
  const externalSignal = options.signal;
  let onExternalAbort: (() => void) | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(id);
      controller.abort();
    } else {
      onExternalAbort = () => controller.abort();
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    // Distinguish external abort from timeout
    if (error instanceof DOMException && error.name === "AbortError") {
      if (externalSignal?.aborted) {
        throw new DOMException("Request was cancelled", "AbortError");
      }
      throw new Error(
        "Request timed out — the server took too long to respond. Please try again."
      );
    }
    throw error;
  } finally {
    if (onExternalAbort && externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}
