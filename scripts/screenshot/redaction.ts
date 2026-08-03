// =============================================================================
// CELEBRA-ME | Screenshot Tool — Safe Diagnostic Records
// =============================================================================

import type { ScreenshotRunReport } from './types.js';
import type { ResolvedScreenshotPlan } from './scope.js';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const SENSITIVE_ASSIGNMENT =
	/(\b(?:authorization|cookie|set-cookie|token|secret|password|signature|sig|access_token|refresh_token|api[_-]?key)\b\s*[:=]\s*)([^\s,;]+)/gi;

/** Remove all query and fragment values from URLs persisted or printed by the tool. */
export function redactScreenshotUrl(value: string): string {
	try {
		const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
		const parsed = new URL(value, 'http://localhost');
		parsed.search = '';
		parsed.hash = '';
		return absolute
			? parsed.toString().replace(/\/$/, parsed.pathname === '/' ? '/' : '')
			: parsed.pathname;
	} catch {
		return value.replace(/([?&][^=\s]+)=([^&\s]+)/g, '$1[redacted]');
	}
}

/** Redact credentials, tokens, and URL query values from diagnostic text. */
export function redactScreenshotText(value: string): string {
	return value
		.replace(/https?:\/\/[^\s"'<>]+/gi, (match) => redactScreenshotUrl(match))
		.replace(SENSITIVE_ASSIGNMENT, '$1[redacted]');
}

function redactScreenshotValue(value: unknown, key?: string): unknown {
	if (typeof value === 'string') {
		const normalizedKey = key?.toLowerCase();
		if (normalizedKey === 'query') return value ? '[redacted]' : value;
		if (['url', 'route', 'routes', 'query', 'key', 'baseurl'].includes(normalizedKey ?? '')) {
			return redactScreenshotUrl(value);
		}
		return redactScreenshotText(value);
	}
	if (Array.isArray(value)) return value.map((item) => redactScreenshotValue(item, key));
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([childKey, childValue]) => [
				childKey,
				redactScreenshotValue(childValue, childKey),
			]),
		);
	}
	return value;
}

export function redactScreenshotPlan(plan: ResolvedScreenshotPlan): ResolvedScreenshotPlan {
	return redactScreenshotValue(plan) as ResolvedScreenshotPlan;
}

export function redactScreenshotReport(report: ScreenshotRunReport): ScreenshotRunReport {
	return redactScreenshotValue(report) as ScreenshotRunReport;
}
