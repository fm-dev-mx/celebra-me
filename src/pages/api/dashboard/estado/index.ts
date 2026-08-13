import type { APIRoute } from 'astro';
import { requireAdminRateLimit } from '@/lib/rsvp/security/admin-rate-limit';
import { errorResponse, jsonResponse, withPrivateCache } from '@/lib/rsvp/core/http';
import { ApiError } from '@/lib/rsvp/core/errors';
import { requireLocalObservabilityAccess } from '@/lib/observability/access';
import {
	getCanonicalStatusView,
	refreshCanonicalStatusView,
} from '@/lib/status/server/canonical-status';
import type { TargetEnv } from '@/lib/status/types';

export const prerender = false;

export const CANONICAL_STATUS_RATE_LIMIT_OPERATION = 'admin:estado' as const;

function parseEnv(value: string | null): TargetEnv | undefined {
	if (value === 'local' || value === 'preview' || value === 'production') return value;
	return undefined;
}

function parseDomain(value: string | null): 'schema' | 'content' | 'patch' | undefined {
	if (value === 'schema' || value === 'content' || value === 'patch') return value;
	return undefined;
}

export const GET: APIRoute = async ({ request }) => {
	try {
		const session = await requireLocalObservabilityAccess(request);
		await requireAdminRateLimit(request, CANONICAL_STATUS_RATE_LIMIT_OPERATION, session.userId);

		const url = new URL(request.url);
		const refresh = url.searchParams.get('refresh') === '1';
		const envParam = url.searchParams.get('env');
		const domainParam = url.searchParams.get('domain');
		const diagnostics = url.searchParams.get('diagnostics') === '1';
		if (envParam !== null && !parseEnv(envParam)) {
			throw new ApiError(400, 'bad_request', 'Parámetro env inválido.');
		}
		if (domainParam !== null && !parseDomain(domainParam)) {
			throw new ApiError(400, 'bad_request', 'Parámetro domain inválido.');
		}

		const view = refresh
			? await refreshCanonicalStatusView({
					env: parseEnv(envParam),
					domain: parseDomain(domainParam),
					diagnostics,
				})
			: await getCanonicalStatusView();
		return withPrivateCache(jsonResponse(view));
	} catch (error) {
		return withPrivateCache(errorResponse(error));
	}
};
