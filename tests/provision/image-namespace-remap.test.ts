import {
	buildNamespaceRemapSql,
	rewriteNamespaceRefs,
	type NamespaceAssetSwap,
	type NamespaceSnapshot,
} from '../../scripts/invitation/image-namespace-remap.ts';

const oldId = '00000000-0000-4000-8000-000000000001';
const newId = '00000000-0000-4000-8000-000000000002';
const swap: NamespaceAssetSwap = {
	oldId,
	newId,
	key: 'hero',
	oldPublicId: 'xv/example/assets/hero-old',
	newPublicId: 'preview/xv/example/assets/hero-aaaaaaaaaaaa',
	newUrl: 'https://res.cloudinary.com/example/image/upload/v1/preview/xv/example/assets/hero-aaaaaaaaaaaa.webp',
	sha256: 'a'.repeat(64),
	mimeType: 'image/webp',
	width: 1200,
	height: 800,
	providerVersion: '1',
	providerMetadata: {},
};
const content = {
	hero: { image: { type: 'uploaded', assetId: oldId, src: 'old' } },
	sharing: { ogImage: { type: 'uploaded', assetId: oldId, src: 'old' } },
	text: 'Keep user-authored content unchanged',
};
const snapshot: NamespaceSnapshot = {
	targetEnvironment: 'preview',
	invitationId: '00000000-0000-4000-8000-000000000003',
	slug: 'example',
	eventType: 'xv',
	draft: { id: '00000000-0000-4000-8000-000000000004', content },
	published: {
		id: '00000000-0000-4000-8000-000000000005',
		version: 2,
		content,
	},
};

describe('hosted image namespace remap', () => {
	it('remaps hero and Open Graph references without changing authored content', () => {
		const result = rewriteNamespaceRefs(content, [swap]);
		expect(result.hero).toEqual({
			image: { type: 'uploaded', assetId: newId, src: swap.newUrl },
		});
		expect(result.sharing).toEqual({
			ogImage: {
				type: 'uploaded',
				assetId: newId,
				src: swap.newUrl.replace(
					'/upload/',
					'/upload/c_fill,g_auto,w_1200,h_630,q_auto,f_auto/',
				),
			},
		});
		expect(result.text).toBe(content.text);
		expect(content.hero.image.assetId).toBe(oldId);
	});

	it('rejects a cross-environment destination before producing a transaction', () => {
		expect(() =>
			buildNamespaceRemapSql(snapshot, [
				{ ...swap, newPublicId: swap.newPublicId.replace('preview/', 'production/') },
			]),
		).toThrow('another invitation');
	});

	it('rejects raw legacy URLs that an uploaded-ref remap would leave behind', () => {
		expect(() =>
			rewriteNamespaceRefs({ ...content, footer: swap.oldPublicId }, [swap]),
		).toThrow('outside uploaded references');
	});

	it('retires an unreferenced legacy row without copying or republishing content', () => {
		const sql = buildNamespaceRemapSql(
			snapshot,
			[],
			[{ id: newId, publicId: 'xv/example/assets/unused-old', sha256: swap.sha256 }],
		);
		expect(sql).toContain('namespace_retirement_source_changed');
		expect(sql).not.toContain('insert into public.invitation_assets');
		expect(sql).not.toContain('public.publish_invitation_atomic');
		expect(() =>
			buildNamespaceRemapSql(
				snapshot,
				[],
				[{ id: oldId, publicId: swap.oldPublicId, sha256: swap.sha256 }],
			),
		).toThrow('still referenced');
	});

	it('generates one transaction with source preconditions before each row swap and RPC publication', () => {
		const sql = buildNamespaceRemapSql(snapshot, [swap]);
		expect(sql).toMatch(/^begin;/u);
		expect(sql).toMatch(/commit;$/u);
		expect(sql.indexOf('namespace_draft_changed')).toBeLessThan(
			sql.indexOf('insert into public.invitation_assets'),
		);
		expect(sql.indexOf('namespace_source_changed')).toBeLessThan(
			sql.indexOf('insert into public.invitation_assets'),
		);
		expect(sql).toContain('public.publish_invitation_atomic');
		expect(sql).not.toContain("'production/xv/example/assets/hero-aaaaaaaaaaaa'");
	});
});
