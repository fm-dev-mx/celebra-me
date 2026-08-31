# Auth and Session Contract

This rule owns server-side Supabase Auth transport and session-cookie behavior anchored to
`src/lib/rsvp/auth/`. It applies to Auth API routes and `src/middleware.ts`.

## Transport

- Every server-side Supabase Auth request must use the transport in `src/lib/rsvp/auth/auth-api.ts`.
- Each request has one 5,000 ms deadline covering connection, headers, and body consumption. The
  transport must abort the request, clear its timer in `finally`, and must not retry.
- Auth failures use `AuthRequestError`; consumers must not parse error strings or upstream bodies.
- A successful response must be validated for the minimum fields required by its operation.
- Each upstream call emits exactly one sanitized structured event. Auth logs must not contain URLs,
  tokens, cookies, request or response bodies, identifiers, emails, user IDs, upstream messages, or
  stack traces.

## Session Resolution

- No access or refresh token means no Auth request.
- A present access token is validated once. A confirmed `400`, `401`, or `403` rejection may fall
  back to one refresh request when a refresh token exists.
- A successful refresh uses the response's embedded validated user and commits rotated access and
  refresh cookies together. It must not make a second `/user` request.
- A confirmed credential rejection clears the primary access, refresh, and trust cookies and keeps
  the existing unauthenticated behavior.
- Timeout, network failure, `429`, `5xx`, or malformed success responses preserve all session,
  refresh, trust, MFA, and idle cookies without writing or deleting cookies.
- Middleware may perform at most two sequential upstream Auth calls per request.

## Failure Responses

- Retryable provider failures return the standard API `503 service_unavailable` envelope or a
  minimal Spanish HTML response using the `usted` register.
- Both forms set `Retry-After: 5` and `Cache-Control: no-store, private`.
- Missing configuration and unexpected application defects return a controlled `500`, preserve
  cookies, and must not redirect as though the user logged out.

## Non-goals

Do not add retries, circuit breakers, JWT/JWKS claim validation, dependencies, database changes, or
client-side Auth logic under this contract.
