/**
 * Structured security events for the daily `security-events` monitor
 * (scripts/ops/scheduled-monitors.ts). Each event is one JSON line: Workers Logs parses it into
 * top-level fields the monitor counts by `kind`.
 *
 * Fields are fixed labels only. Never pass e-mails, login identifiers, IPs (full or hashed),
 * passwords, tokens or user ids: the logs are kept outside the database's access controls.
 */

export const SECURITY_EVENT = 'security_event';

export type SecurityEventKind = 'rate_limited' | 'login_failed' | 'mfa_failed';

type SecurityEventFields = {
	rate_limited: { namespace: string };
	login_failed: { route: 'login-host' | 'change-password' };
	mfa_failed: { reason: 'invalid_elevated_token' | 'missing_mfa_evidence' };
};

export function logSecurityEvent<K extends SecurityEventKind>(
	kind: K,
	fields: SecurityEventFields[K],
): void {
	console.warn(JSON.stringify({ event: SECURITY_EVENT, kind, ...fields }));
}
