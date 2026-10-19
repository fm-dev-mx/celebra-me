/** Read-only, loopback-only publication transport for browser tests; never a database emulator. */
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { listInvitationDefinitions } from '../provision/invitations/registry.ts';
import {
	getInvitationAssetSourceDir,
	type UploadedAssetRef,
} from '../provision/invitations/invitation-definition.ts';
import {
	buildNormalizedInvitationRelease,
	materializeAssetReferences,
} from '../provision/normalized-invitation-release.ts';
import {
	CANONICAL_MEMORIES_SLUG,
	buildCanonicalMemorySpaceRow,
} from './canonical-memories-fixture.ts';
import {
	CANONICAL_ACCESS_FIXTURE_IDS,
	CANONICAL_ACCESS_FIXTURE_SLUGS,
	canonicalAccessStateFor,
} from './canonical-access-fixture.ts';

if (process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES !== 'true') {
	throw new Error('Canonical fixtures require explicit PLAYWRIGHT_USE_CANONICAL_FIXTURES=true.');
}

const origin = 'http://127.0.0.1:54321';
const assets = new Map<string, { bytes: Uint8Array; mimeType: string }>();
const publications: Record<string, unknown>[] = [];

/** Embedded access state, as PostgREST returns it for `invitation:invitations(access:...)`. */
function accessEmbed(paymentStatus: 'paid' | 'unpaid', publicAccess: 'enabled' | 'disabled') {
	return { access: { payment_status: paymentStatus, public_access: publicAccess } };
}
for (const definition of listInvitationDefinitions().filter(
	(item) => item.lifecycle === 'published',
)) {
	// Explicit sourceDir prevents the release builder from falling back to a persistent provider.
	const release = await buildNormalizedInvitationRelease({
		slug: definition.slug,
		purpose: 'package',
		sourceDir: resolve(getInvitationAssetSourceDir(definition)),
	});
	const references: Record<string, UploadedAssetRef> = {};
	for (const asset of release.assets) {
		const assetPath = `/storage/v1/object/public/invitation-assets/${definition.slug}/${asset.sha256}`;
		assets.set(assetPath, { bytes: asset.bytes, mimeType: asset.mimeType });
		const hash = asset.sha256;
		const assetId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
		references[asset.key] = { type: 'uploaded', assetId, src: `${origin}${assetPath}` };
	}
	publications.push({
		id: definition.managedIdentityId,
		invitation_project_id: definition.managedIdentityId,
		slug: definition.slug,
		event_type: definition.eventType,
		is_demo: false,
		content: materializeAssetReferences(release.publishedProjection, references),
		version: 1,
		published_at: definition.createdAt,
		created_at: definition.createdAt,
		updated_at: definition.createdAt,
		invitation: accessEmbed('paid', 'enabled'),
	});
}
// Canonical invitations are paid; these clones exercise the unpaid preview and the disabled page.
const accessSource = publications[0];
if (accessSource) {
	publications.push(
		{
			...accessSource,
			id: CANONICAL_ACCESS_FIXTURE_IDS.unpaid,
			invitation_project_id: CANONICAL_ACCESS_FIXTURE_IDS.unpaid,
			slug: CANONICAL_ACCESS_FIXTURE_SLUGS.unpaid,
			invitation: accessEmbed('unpaid', 'enabled'),
		},
		{
			...accessSource,
			id: CANONICAL_ACCESS_FIXTURE_IDS.disabled,
			invitation_project_id: CANONICAL_ACCESS_FIXTURE_IDS.disabled,
			slug: CANONICAL_ACCESS_FIXTURE_SLUGS.disabled,
			invitation: accessEmbed('paid', 'disabled'),
		},
	);
}

const UNSUPPORTED = Symbol('unsupported');
const eqParam = (url: URL, name: string) => url.searchParams.get(name)?.replace(/^eq\./, '');

/** Access row (payment and public access) of a canonical fixture invitation. */
function accessRowFor(invitationId: string): Record<string, unknown> {
	const state = canonicalAccessStateFor(invitationId);
	return {
		invitation_id: invitationId,
		payment_status: state.paymentStatus,
		public_access: state.publicAccess,
		internal_note: null,
		version: 1,
		updated_at: '2026-10-10T00:00:00Z',
		updated_by: null,
	};
}

function resolveFixtureResult(url: URL): unknown {
	switch (url.pathname) {
		case '/health':
		case '/auth/v1/health':
			return { fixture: true, publications: publications.length };
		case '/rest/v1/published_invitation_content': {
			const slug = eqParam(url, 'slug');
			const eventType = eqParam(url, 'event_type');
			return publications.filter((row) => row.slug === slug && row.event_type === eventType);
		}
		case '/rest/v1/invitations':
			return url.searchParams.get('select') === 'archived_at' ? [] : UNSUPPORTED;
		case '/rest/v1/invitation_access_controls':
			return [accessRowFor(eqParam(url, 'invitation_id') ?? '')];
		case '/rest/v1/events':
			// No canonical RSVP event links an invitation: memories and RSVP see no access row.
			return [];
		case '/rest/v1/event_memory_settings':
			return eqParam(url, 'public_slug') === CANONICAL_MEMORIES_SLUG
				? [buildCanonicalMemorySpaceRow()]
				: [];
		default:
			return UNSUPPORTED;
	}
}

const server = createServer((request, response) => {
	const url = new URL(request.url ?? '/', origin);
	response.setHeader('Cache-Control', 'no-store');
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		response.writeHead(405).end('Fixture transport is read-only.');
		return;
	}
	const asset = assets.get(url.pathname);
	if (asset) {
		response.writeHead(200, {
			'Content-Type': asset.mimeType,
			'Content-Length': asset.bytes.length,
		});
		response.end(request.method === 'HEAD' ? undefined : asset.bytes);
		return;
	}
	const result = resolveFixtureResult(url);
	if (result === UNSUPPORTED) {
		response.writeHead(404).end('Unsupported fixture request.');
		return;
	}
	response.writeHead(200, { 'Content-Type': 'application/json' });
	response.end(request.method === 'HEAD' ? undefined : JSON.stringify(result));
});
server.listen(54321, '127.0.0.1', () => {
	console.log(
		`Canonical browser fixtures ready: ${publications.length} publications; no persistent database.`,
	);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => server.close(() => process.exit(0)));
}
