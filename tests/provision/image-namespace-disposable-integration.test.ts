/** Executes the image row remap against the disposable PostgreSQL contract. */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { runPsql } from '../../scripts/db/db-workflow-lib.ts';
import { DISPOSABLE_DB_URL } from '../../scripts/db/db-target-config.ts';
import {
	buildNamespaceRemapSql,
	buildNamespaceRollbackSql,
	type NamespaceAssetSwap,
	type NamespaceSnapshot,
} from '../../scripts/invitation/image-namespace-remap.ts';

const enabled = process.env.CELEBRA_MANAGED_DB_CONTRACTS === '1';
const invitationId = '10000000-0000-4000-8000-000000000001';
const draftId = '10000000-0000-4000-8000-000000000002';
const publishedId = '10000000-0000-4000-8000-000000000003';
const assetId = '10000000-0000-4000-8000-000000000004';
const newAssetId = '10000000-0000-4000-8000-000000000005';
const sha256 = 'a'.repeat(64);
const oldPublicId = 'boda/namespace-contract/assets/hero-legacy';
const content = {
	sectionOrder: ['hero'],
	hero: {
		image: {
			type: 'uploaded',
			assetId,
			src: `https://res.cloudinary.com/test/image/upload/v1/${oldPublicId}.webp`,
		},
	},
};
const snapshot: NamespaceSnapshot = {
	targetEnvironment: 'preview',
	invitationId,
	slug: 'namespace-contract',
	eventType: 'boda',
	draft: { id: draftId, content },
	published: { id: publishedId, version: 1, content },
};
const swap: NamespaceAssetSwap = {
	oldId: assetId,
	newId: newAssetId,
	key: 'hero',
	oldPublicId,
	newPublicId: 'preview/boda/namespace-contract/assets/hero-aaaaaaaaaaaa',
	newUrl: 'https://res.cloudinary.com/test/image/upload/v1/preview/boda/namespace-contract/assets/hero-aaaaaaaaaaaa.webp',
	sha256,
	mimeType: 'image/webp',
	width: 1200,
	height: 800,
	providerVersion: '1',
	providerMetadata: { verified: true },
};

function sql(query: string): string {
	return runPsql(query, DISPOSABLE_DB_URL, {
		tuplesOnly: true,
		throwOnError: true,
	}).stdout.trim();
}

function seed(): void {
	sql('truncate table public.invitations cascade;');
	sql(`insert into public.invitations
		(id, slug, title, event_type, status, base_demo_id, theme_id, snapshot, created_by, kind)
		values ('${invitationId}', 'namespace-contract', 'Namespace contract', 'boda',
		'published', 'demo-wedding-classic', 'classic', '{}'::jsonb,
		'a0000000-0000-0000-0000-000000000002', 'client');`);
	sql(`insert into public.invitation_content_drafts (id, invitation_project_id, content, status)
		values ('${draftId}', '${invitationId}', '${JSON.stringify(content)}'::jsonb, 'approved');`);
	sql(`insert into public.published_invitation_content
		(id, invitation_project_id, slug, event_type, is_demo, content, version)
		values ('${publishedId}', '${invitationId}', 'namespace-contract', 'boda', false,
		'${JSON.stringify(content)}'::jsonb, 1);`);
	sql(`insert into public.invitation_assets
		(id, invitation_id, display_name, bucket, storage_path, mime_type, width, height,
		file_size, validation_version, original_mime_type, original_file_size, provider,
		provider_public_id, provider_version, secure_url, sha256, provider_metadata)
		values ('${assetId}', '${invitationId}', 'Hero', 'invitation-assets', '${oldPublicId}',
		'image/webp', 1200, 800, 100000, 1, 'image/webp', 100000, 'cloudinary',
		'${oldPublicId}', '1', 'https://res.cloudinary.com/test/image/upload/v1/${oldPublicId}.webp',
		'${sha256}', '{}'::jsonb);`);
}

describe('image namespace remap on disposable database', () => {
	if (!enabled) {
		it('requires the disposable managed contract harness', () => {
			throw new Error('Run through pnpm test:db:managed-contracts.');
		});
		return;
	}

	beforeEach(seed);

	it('atomically replaces the immutable asset row and republishes both references', () => {
		sql(buildNamespaceRemapSql(snapshot, [swap]));
		const rows = JSON.parse(
			sql(`select json_agg(json_build_object('id', id, 'deleted',
			deleted_at is not null, 'publicId', provider_public_id)) from public.invitation_assets
			where invitation_id = '${invitationId}';`),
		) as {
			id: string;
			deleted: boolean;
			publicId: string;
		}[];
		expect(rows).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: assetId, deleted: true, publicId: oldPublicId }),
				expect.objectContaining({
					id: newAssetId,
					deleted: false,
					publicId: swap.newPublicId,
				}),
			]),
		);
		const state = JSON.parse(
			sql(`select json_build_object(
			'draft', (select content from public.invitation_content_drafts where id = '${draftId}'),
			'published', (select content from public.published_invitation_content where id = '${publishedId}'),
			'version', (select version from public.published_invitation_content where id = '${publishedId}'))::text;`),
		) as {
			draft: typeof content;
			published: typeof content;
			version: number;
		};
		expect(state.draft.hero.image.assetId).toBe(newAssetId);
		expect(state.published.hero.image.assetId).toBe(newAssetId);
		expect(state.version).toBe(2);
	});

	it('leaves the original row and publication intact when the source precondition fails', () => {
		sql(
			`update public.invitation_assets set sha256 = '${'b'.repeat(64)}' where id = '${assetId}';`,
		);
		expect(() => sql(buildNamespaceRemapSql(snapshot, [swap]))).toThrow();
		expect(
			sql(
				`select count(*) from public.invitation_assets where invitation_id = '${invitationId}' and deleted_at is null;`,
			),
		).toBe('1');
		expect(
			sql(
				`select version from public.published_invitation_content where id = '${publishedId}';`,
			),
		).toBe('1');
	});

	it('restores the original row and references only for the exact migrated version', () => {
		sql(buildNamespaceRemapSql(snapshot, [swap]));
		sql(buildNamespaceRollbackSql(snapshot, [swap]));
		expect(
			sql(`select id::text from public.invitation_assets where invitation_id = '${invitationId}'
			and deleted_at is null;`),
		).toBe(assetId);
		expect(
			sql(
				`select version from public.published_invitation_content where id = '${publishedId}';`,
			),
		).toBe('3');
		expect(
			JSON.parse(
				sql(`select content::text from public.published_invitation_content
			where id = '${publishedId}';`),
			),
		).toEqual(content);
	});

	it('rejects rollback after a later publication without changing either asset row', () => {
		sql(buildNamespaceRemapSql(snapshot, [swap]));
		sql(`update public.published_invitation_content set version = version + 1
			where id = '${publishedId}';`);
		expect(() => sql(buildNamespaceRollbackSql(snapshot, [swap]))).toThrow();
		expect(
			sql(`select id::text from public.invitation_assets where invitation_id = '${invitationId}'
			and deleted_at is null;`),
		).toBe(newAssetId);
	});
});
