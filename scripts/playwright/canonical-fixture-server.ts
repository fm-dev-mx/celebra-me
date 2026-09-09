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

if (process.env.PLAYWRIGHT_USE_CANONICAL_FIXTURES !== 'true') {
	throw new Error('Canonical fixtures require explicit PLAYWRIGHT_USE_CANONICAL_FIXTURES=true.');
}

const origin = 'http://127.0.0.1:54321';
const assets = new Map<string, { bytes: Uint8Array; mimeType: string }>();
const publications: Record<string, unknown>[] = [];
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
	});
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
	let result: unknown;
	if (url.pathname === '/health' || url.pathname === '/auth/v1/health') {
		result = { fixture: true, publications: publications.length };
	} else if (url.pathname === '/rest/v1/published_invitation_content') {
		const slug = url.searchParams.get('slug')?.replace(/^eq\./, '');
		const eventType = url.searchParams.get('event_type')?.replace(/^eq\./, '');
		result = publications.filter((row) => row.slug === slug && row.event_type === eventType);
	} else if (
		url.pathname === '/rest/v1/invitations' &&
		url.searchParams.get('select') === 'archived_at'
	) {
		result = [];
	} else {
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
