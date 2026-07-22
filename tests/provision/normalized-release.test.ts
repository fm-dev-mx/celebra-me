import { describe, expect, it } from '@jest/globals';
import { buildSemanticAssetMap, materializeAssetReferences } from '../../scripts/provision/normalized-invitation-release.ts';
import { rominaInvitation } from '../../scripts/provision/invitations/romina-rios-chaparro.ts';

describe('normalized managed release semantics', () => {
	it('uses declared semantic keys rather than environment UUIDs', () => {
		const semantic = buildSemanticAssetMap(rominaInvitation);
		expect(semantic.hero.assetId).toContain('__INVITATION_ASSET_KEY__:hero');
		const materialized = materializeAssetReferences({ image: semantic.hero }, { hero: { type: 'uploaded', assetId: '00000000-0000-4000-8000-000000000001', src: 'https://target.example/hero.webp' } }) as { image: { assetId: string; src: string } };
		expect(materialized.image).toEqual({ type: 'uploaded', assetId: '00000000-0000-4000-8000-000000000001', src: 'https://target.example/hero.webp' });
	});
});
