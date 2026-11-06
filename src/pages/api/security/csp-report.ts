import type { APIRoute } from 'astro';
import { checkRateLimit } from '@/lib/rsvp/security/rate-limit-provider';
import { getIp } from '@/lib/rsvp/core/http';
import { logSecurityEvent } from '@/lib/server/security-events';
import { readBoundedRequestText } from '@/lib/rsvp/core/http';

const MAX_BODY_BYTES = 8 * 1024;

/** Loose shape of a CSP violation report (browser-sent JSON). */
interface CspReportBody {
	'csp-report'?: {
		'document-uri'?: string;
		'violated-directive'?: string;
		'effective-directive'?: string;
		'blocked-uri'?: string;
		'original-policy'?: string;
		disposition?: string;
		'status-code'?: number;
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCspReport(value: unknown): value is CspReportBody {
	if (!isRecord(value)) return false;
	const report = value['csp-report'];
	return report === undefined || isRecord(report);
}

/** Strip query strings and fragments that could contain personal data. */
function sanitizeUri(raw: unknown): string {
	if (typeof raw !== 'string') return '';
	try {
		const url = new URL(raw);
		return `${url.origin}${url.pathname}`;
	} catch {
		// Not a valid URL — return the scheme + host if parseable, otherwise a placeholder.
		const match = /^(https?:\/\/[^/?#]+)/.exec(raw);
		return match ? match[1] : '(invalid)';
	}
}

/** Truncate a directive string to a safe log-friendly length. */
function sanitizeDirective(raw: unknown): string {
	if (typeof raw !== 'string') return '';
	return raw.slice(0, 128);
}

export const POST: APIRoute = async ({ request }) => {
	const ip = getIp(request);

	const allowed = await checkRateLimit({
		namespace: 'tracking',
		entityId: 'csp-report',
		ip,
		maxHits: 30,
		windowSec: 60,
	});

	if (!allowed) {
		return new Response(null, { status: 429 });
	}

	let body: string;
	try {
		body = await readBoundedRequestText(request, MAX_BODY_BYTES);
	} catch {
		return new Response(null, { status: 413 });
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return new Response(null, { status: 400 });
	}

	if (!isCspReport(parsed)) {
		return new Response(null, { status: 400 });
	}

	const report = parsed['csp-report'];
	if (report) {
		const directive = sanitizeDirective(
			report['effective-directive'] || report['violated-directive'],
		);
		const blocked = sanitizeUri(report['blocked-uri']);

		logSecurityEvent('csp_violation', { directive, blocked });
	}

	return new Response(null, { status: 204 });
};
