/**
 * Service-worker caching policy. Only the static application shell
 * (precached build assets + index.html for navigations) is cached.
 *
 * Never cached: authenticated API responses, chat, pickup addresses,
 * medicine information, uploaded images or any third-party request.
 * The API also sends `Cache-Control: no-store` as a second line of defence.
 */
export const NEVER_CACHE_PATH_PATTERNS: readonly RegExp[] = [/^\/api\//, /^\/healthz$/, /^\/__\//];

/** Whether a same-origin navigation should be answered with the cached shell. */
export function shouldServeAppShell(url: URL, origin: string): boolean {
  if (url.origin !== origin) return false;
  return !NEVER_CACHE_PATH_PATTERNS.some((re) => re.test(url.pathname));
}
