import {
	buildNamespaceRemapSql,
	buildNamespaceRollbackSql,
	rewriteNamespaceRefs,
	type NamespaceAssetSwap,
	type NamespaceSnapshot,
} from '../../scripts/invitation/image-namespace-remap.ts';
import {
	buildR2ObjectKey,
	buildR2PublicUrl,
	buildR2SocialObjectKey,
} from '../../src/lib/intake/services/r2-invitation-media.ts';

const oldId = '00000000-0000-4000-8000-000000000001';
const newId = '00000000-0000-4000-8000-000000000002';
const sha256 = 'a'.repeat(64);
const objectKey = buildR2ObjectKey({
	eventType: 'xv',
	slug: 'example',
	key: 'hero',
	sha256,
	mimeType: 'image/webp',
});
const swap: NamespaceAssetSwap = {
	oldId,
	newId,
	key: 'hero',
	oldPublicId: 'production/xv/example/assets/hero-aaaaaaaaaaaa',
	newPublicId: objectKey,
	newUrl: buildR2PublicUrl('production', objectKey),
	newOgUrl: buildR2PublicUrl('production', buildR2SocialObjectKey(objectKey)),
	sha256,
	mimeType: 'image/webp',
	width: 1200,
	height: 800,
	providerVersion: sha256,
	providerMetadata: { storage_provider: 'r2' },
};
const oldMusic = 'https://res.cloudinary.com/example/video/upload/v1700000000/song_abc123.mp3';
const newMusic = buildR2PublicUrl(
	'production',
	buildR2ObjectKey({
		eventType: 'xv',
		slug: 'example',
		key: 'music',
		sha256: 'b'.repeat(64),
		mimeType: 'audio/mpeg',
	}),
);
const options = { destination: 'r2' as const, urlSwaps: [{ oldUrl: oldMusic, newUrl: newMusic }] };
const content = {
	hero: { image: { type: 'uploaded', assetId: oldId, src: 'old' } },
	sharing: { ogImage: { type: 'uploaded', assetId: oldId, src: 'old' } },
	music: { url: oldMusic },
	text: 'Keep user-authored content unchanged',
};
const snapshot: NamespaceSnapshot = {
	targetEnvironment: 'production',
	invitationId: '00000000-0000-4000-8000-000000000003',
	slug: 'example',
	eventType: 'xv',
	draft: { id: '00000000-0000-4000-8000-000000000004', content },
	published: { id: '00000000-0000-4000-8000-000000000005', version: 2, content },
};

describe('R2 media keys', () => {
	it('builds content-addressed keys and a sibling social card', () => {
		expect(objectKey).toBe(`invitations/xv/example/hero-${sha256}.webp`);
		expect(buildR2SocialObjectKey(objectKey)).toBe(
			`invitations/xv/example/hero-${sha256}.og.jpg`,
		);
		expect(swap.newUrl).toBe(`https://media.celebra-me.com/${objectKey}`);
		expect(buildR2PublicUrl('preview', objectKey)).toBe(
			`https://media-staging.celebra-me.com/${objectKey}`,
		);
	});

	it('rejects keys that are not content-addressed or canonical', () => {
		expect(() =>
			buildR2ObjectKey({
				eventType: 'xv',
				slug: 'Example',
				key: 'hero',
				sha256,
				mimeType: 'image/webp',
			}),
		).toThrow('canonical');
		expect(() =>
			buildR2ObjectKey({
				eventType: 'xv',
				slug: 'example',
				key: 'hero',
				sha256: 'abc',
				mimeType: 'image/webp',
			}),
		).toThrow('sha256');
		expect(() =>
			buildR2ObjectKey({
				eventType: 'xv',
				slug: 'example',
				key: 'hero',
				sha256,
				mimeType: 'image/gif',
			}),
		).toThrow('Unsupported');
	});
});

describe('R2 media remap', () => {
	it('rewrites uploaded refs, the prepared social card and literal audio URLs', () => {
		const result = rewriteNamespaceRefs(content, [swap], options);
		expect(result.hero).toEqual({
			image: { type: 'uploaded', assetId: newId, src: swap.newUrl },
		});
		expect(result.sharing).toEqual({
			ogImage: { type: 'uploaded', assetId: newId, src: swap.newOgUrl },
		});
		expect(result.music).toEqual({ url: newMusic });
		expect(result.text).toBe(content.text);
	});

	it('leaves an unplanned audio URL for the plan coverage check', () => {
		expect(() =>
			rewriteNamespaceRefs(content, [swap], { ...options, urlSwaps: [] }),
		).not.toThrow();
		const residual = rewriteNamespaceRefs(content, [swap], { ...options, urlSwaps: [] });
		expect(JSON.stringify(residual)).toContain(oldMusic);
	});

	it('inserts R2 rows into the environment bucket and republishes in one transaction', () => {
		const sql = buildNamespaceRemapSql(snapshot, [swap], [], options);
		expect(sql).toContain(`'r2', '${objectKey}'`);
		expect(sql).toContain(`'celebra-me-invitation-media', '${objectKey}'`);
		expect(sql).toContain(newMusic);
		// The old content appears only in the concurrency guard, never in the new publication.
		expect(sql.split('p_content =>')[1]).not.toContain(oldMusic);
		expect(sql).toContain('publish_invitation_atomic');
	});

	it('refuses an R2 key that belongs to another invitation', () => {
		expect(() =>
			buildNamespaceRemapSql(
				snapshot,
				[{ ...swap, newPublicId: objectKey.replace('/example/', '/other/') }],
				[],
				options,
			),
		).toThrow('belongs to another invitation');
	});

	it('restores the original draft, publication and audio URL on rollback', () => {
		const sql = buildNamespaceRollbackSql(snapshot, [swap], [], options);
		expect(sql).toContain(oldMusic);
		expect(sql).toContain('namespace_rollback_target_changed');
	});
});
