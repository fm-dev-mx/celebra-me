import { cesarInvitation } from '../../scripts/provision/invitations/cesar-ramses';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release';

describe('Cesar Ramses published hero', () => {
	it('keeps the production landscape image on desktop and the separate mobile portrait', () => {
		expect(cesarInvitation.assets.find((asset) => asset.key === 'hero')?.relativePath).toBe(
			'gallery-02.webp',
		);
		expect(
			cesarInvitation.assets.find((asset) => asset.key === 'heroMobile')?.relativePath,
		).toBe('hero-production.jpg');
		const assets = buildSemanticAssetMap(cesarInvitation);
		const content = cesarInvitation.buildPublishedContent(assets);
		expect(content.hero).toMatchObject({
			backgroundImage: assets.hero,
			backgroundImageMobile: assets.heroMobile,
		});
	});
});
