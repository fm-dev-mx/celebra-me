import fixture from '../local-render-corpus/fixtures/gerardo-sesenta.json' with { type: 'json' };
import {
	defineFixtureBackedInvitation,
	deriveFixtureManagedIdentityId,
} from './fixture-backed-definition.ts';
import type { LocalRenderCorpusFixture } from '../local-render-corpus/fixture-types.ts';

const source = fixture as LocalRenderCorpusFixture;

export const gerardoInvitation = defineFixtureBackedInvitation({
	fixture: source,
	managedIdentityId: deriveFixtureManagedIdentityId(source.slug),
	hostLoginAlias: 'gerardo_sesenta',
	assetDir: 'src/assets/images/events/gerardo-sesenta',
	deliveryScope: 'content-and-assets',
	assetFiles: {
		hero: 'hero.webp', portrait: 'portrait.webp', jardin: 'jardin.webp', family: 'family.webp',
		gallery01: 'gallery-01.webp', gallery02: 'gallery-02.webp', gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp', gallery05: 'gallery-05.webp', gallery06: 'gallery-06.webp',
		interlude01: 'gallery-01.webp', interlude02: 'gallery-02.webp',
	},
});
