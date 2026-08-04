/**
 * Freshness metadata and redaction helpers for read-only status probes.
 * Server-only. Never reads caches or historical snapshots.
 */

export interface FreshnessMeta {
	/** Always live for status-core; consumers must not invent healthy from history. */
	source: 'live';
	probedAt: string;
	/** True when this environment's result is due to budget exhaustion, not a proven outage. */
	timeoutDegraded: boolean;
}

export function createLiveFreshness(timeoutDegraded = false): FreshnessMeta {
	return {
		source: 'live',
		probedAt: new Date().toISOString(),
		timeoutDegraded,
	};
}

/** Strip connection strings, absolute paths, and noisy stack fragments from probe errors. */
export function redactProbeError(message: string): string {
	return message
		.replace(/postgres(?:ql)?:\/\/[^\s)'"]+/gi, '[redacted-db-url]')
		.replace(/[A-Za-z]:\\[^\s)'"]+/g, '[redacted-path]')
		.replace(/\/(?:Users|home|var|tmp)\/[^\s)'"]+/gi, '[redacted-path]')
		.replace(/\b[0-9a-f]{64}\b/gi, '[redacted-hash]')
		.slice(0, 280);
}
