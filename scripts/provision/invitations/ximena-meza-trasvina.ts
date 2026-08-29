import fixture from '../local-render-corpus/fixtures/ximena-meza-trasvina.json' with { type: 'json' };
import {
	defineFixtureBackedInvitation,
	deriveFixtureManagedIdentityId,
} from './fixture-backed-definition.ts';
import type { LocalRenderCorpusFixture } from '../local-render-corpus/fixture-types.ts';

const source = fixture as LocalRenderCorpusFixture;

export const ximenaInvitation = defineFixtureBackedInvitation({
	fixture: source,
	managedIdentityId: deriveFixtureManagedIdentityId(source.slug),
	hostLoginAlias: 'ximena_meza_trasvina',
	assetDir: 'src/assets/images/events/ximena-meza-trasvina',
	deliveryScope: 'content-and-assets',
	assetFiles: {
		hero: 'hero.webp', portrait: 'portrait.webp', family: 'family.webp', jardin: 'gallery-03.webp',
		gallery01: 'gallery-01.webp', gallery02: 'gallery-02.webp', gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp', gallery05: 'gallery-05.webp', gallery07: 'ai/gallery-07.webp',
		gallery09: 'ai/gallery-09.webp', gallery10: 'gallery-10.webp', gallery12: 'gallery-12.webp',
		interlude01: 'ai/interlude-01.webp', interlude02: 'gallery-12.webp',
		interlude03: 'ai/gallery-09.webp', interlude04: 'interlude-04.webp',
		interlude05: 'gallery-10.webp', interlude06: 'gallery-05.webp',
		thankYouPortrait: 'thank-you-portrait.webp',
	},
});
