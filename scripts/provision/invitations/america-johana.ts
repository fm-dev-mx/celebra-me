import fixture from '../local-render-corpus/fixtures/america-johana.json' with { type: 'json' };
import {
	defineFixtureBackedInvitation,
	deriveFixtureManagedIdentityId,
} from './fixture-backed-definition.ts';
import type { LocalRenderCorpusFixture } from '../local-render-corpus/fixture-types.ts';

const source = fixture as LocalRenderCorpusFixture;

export const americaInvitation = defineFixtureBackedInvitation({
	fixture: source,
	managedIdentityId: deriveFixtureManagedIdentityId(source.slug),
	hostLoginAlias: 'america_johana',
	assetDir: 'src/assets/images/events/xv-america-johana',
	deliveryScope: 'content-and-assets',
	assetFiles: {
		family: 'family.webp',
		gallery01: 'gallery-01.webp', gallery02: 'gallery-02.webp', gallery04: 'gallery-04.webp',
		gallery05: 'gallery-05.webp', gallery06: 'gallery-06.webp', gallery07: 'gallery-07.webp',
		gallery08: 'gallery-08.webp', gallery09: 'gallery-09.webp', gallery10: 'gallery-10.webp',
		hero: 'hero.webp', heroMobile: 'hero.webp', heroDesktop: 'hero-desktop.webp',
		interlude01: 'interlude-01.webp', interlude02: 'interlude-02.webp',
		interlude03: 'interlude-03.webp', interlude04: 'interlude-04.webp',
		portrait: 'portrait.webp', thankYouPortrait: 'thank-you-portrait.webp',
	},
});
