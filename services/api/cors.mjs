const LOOPBACK_DASHBOARD_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function corsHeaders(requestOrigin, configuredOrigin = process.env.CORS_ORIGIN) {
  const fallbackOrigin = configuredOrigin ?? "http://localhost:3000";
  const allowed = requestOrigin && (LOOPBACK_DASHBOARD_ORIGINS.has(requestOrigin) || requestOrigin === configuredOrigin)
    ? requestOrigin
    : fallbackOrigin;
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}
