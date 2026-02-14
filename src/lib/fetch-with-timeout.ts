/**
 * Fetch with timeout — wraps native fetch with AbortController
 * so requests don't hang indefinitely on slow/dead servers.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 30000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Request timed out — the server took too long to respond. Please try again."
      );
    }
    throw error;
  }
}
