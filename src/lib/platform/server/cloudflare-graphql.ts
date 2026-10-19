/**
 * Cloudflare GraphQL Analytics API transport shared by the console reader and
 * the snapshot collector. A GraphQL error (HTTP 200 with `errors`) is a
 * failure: partial data is discarded so a dataset never reports half a figure.
 */

import {
	type ProviderFailure,
	fetchProviderJson,
	isRecord,
	sanitizeProviderCode,
} from './provider-request';

const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

export type CloudflareGraphqlResult =
	| { ok: true; viewer: Record<string, unknown> }
	| { ok: false; failure: ProviderFailure; code?: string };

export async function queryCloudflareGraphql(
	query: string,
	variables: Record<string, string>,
	token: string,
	fetchImpl: typeof fetch,
): Promise<CloudflareGraphqlResult> {
	const result = await fetchProviderJson(
		GRAPHQL_ENDPOINT,
		{ method: 'POST', token, body: { query, variables } },
		fetchImpl,
	);
	if (!result.ok) return result;
	const payload = isRecord(result.body) ? result.body : null;
	const errors = Array.isArray(payload?.errors) ? payload.errors : [];
	if (errors.length > 0) {
		const first = isRecord(errors[0]) ? errors[0] : null;
		const extensions = isRecord(first?.extensions) ? first.extensions : null;
		return {
			ok: false,
			failure: 'graphql_error',
			code: sanitizeProviderCode(extensions?.code),
		};
	}
	const viewer = isRecord(payload?.data) ? payload.data.viewer : null;
	return isRecord(viewer) ? { ok: true, viewer } : { ok: false, failure: 'malformed' };
}

/** First account (or zone) node under `viewer[key]`, or null when absent. */
export function firstViewerNode(
	viewer: Record<string, unknown>,
	key: 'accounts' | 'zones',
): Record<string, unknown> | null {
	const nodes = viewer[key];
	if (!Array.isArray(nodes)) return null;
	const first: unknown = nodes[0];
	return isRecord(first) ? first : null;
}
