import fixture from '../local-render-corpus/fixtures/leah-lexa.json' with { type: 'json' };
import {
	defineFixtureBackedInvitation,
	deriveFixtureManagedIdentityId,
} from './fixture-backed-definition.ts';
import type { LocalRenderCorpusFixture } from '../local-render-corpus/fixture-types.ts';

const source = fixture as LocalRenderCorpusFixture;

export const leahInvitation = defineFixtureBackedInvitation({
	fixture: source,
	managedIdentityId: deriveFixtureManagedIdentityId(source.slug),
	hostLoginAlias: 'leah_lexa',
	assetDir: 'src/assets/images/events/leah-lexa-baby-shower',
	deliveryScope: 'content-and-assets',
	assetFiles: {
		hero: 'hero.webp', family: 'family.webp', gallery01: 'gallery-01.webp',
		gallery02: 'gallery-02.webp', gallery03: 'gallery-03.webp',
	},
});
