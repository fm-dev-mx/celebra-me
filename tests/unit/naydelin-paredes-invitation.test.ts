import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { naydelinInvitation } from '../../scripts/provision/invitations/naydelin-paredes';
import { getInvitationAssetSourceDir } from '../../scripts/provision/invitations/invitation-definition';
import { canonicalEventContentSchema } from '@/lib/schemas/content/base-event.schema';

function buildContent() {
	return canonicalEventContentSchema.parse(
		naydelinInvitation.buildPublishedContent(
			Object.fromEntries(
				naydelinInvitation.assets.map((asset) => [
					asset.key,
					{
						type: 'uploaded' as const,
						assetId: `__INVITATION_ASSET_KEY__:${asset.key}`,
						src: `/${asset.relativePath}`,
					},
				]),
			),
		),
	);
}

describe('naydelin-paredes invitation definition', () => {
	it('keeps the Los Mochis event instant', () => {
		expect(naydelinInvitation.eventTiming).toEqual({
			localDateTime: '2026-10-17T19:00',
			timeZone: 'America/Mazatlan',
			startsAtUtc: '2026-10-18T02:00:00.000Z',
		});
	});

	it('ships every declared delivery asset from its source directory', () => {
		const assetDir = join(process.cwd(), getInvitationAssetSourceDir(naydelinInvitation));
		for (const asset of naydelinInvitation.assets) {
			expect(existsSync(join(assetDir, asset.relativePath))).toBe(true);
		}
	});

	it('binds each photograph to a single role', () => {
		const content = buildContent();
		const used = [
			content.hero.backgroundImage,
			...(content.gallery?.items ?? []).map((item) => item.image),
			...(content.interludes ?? []).map((interlude) => interlude.image),
			content.thankYou?.image,
		].map((image) =>
			image && typeof image === 'object' && 'assetId' in image ? image.assetId : image,
		);
		expect(new Set(used).size).toBe(used.length);
		expect(content.gallery?.items).toHaveLength(5);
		expect(content.interludes?.map((interlude) => interlude.afterSection)).toEqual([
			'personalizedAccess',
			'countdown',
		]);
		expect(content.thankYou?.variant).toBe('portrait-letter');
	});

	it('enables personalized passes with web confirmation', () => {
		const content = buildContent();
		expect(content.rsvp).toMatchObject({
			accessMode: 'personalized-only',
			confirmationMode: 'api',
		});
		expect(content.sectionOrder).toContain('personalizedAccess');
	});
});
