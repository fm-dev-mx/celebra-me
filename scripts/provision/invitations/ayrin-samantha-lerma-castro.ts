import fixture from '../local-render-corpus/fixtures/ayrin-samantha-lerma-castro.json' with { type: 'json' };
import {
	defineFixtureBackedInvitation,
	deriveFixtureManagedIdentityId,
} from './fixture-backed-definition.ts';
import type { LocalRenderCorpusFixture } from '../local-render-corpus/fixture-types.ts';

const source = fixture as LocalRenderCorpusFixture;

export const ayrinInvitation = defineFixtureBackedInvitation({
	fixture: source,
	managedIdentityId: deriveFixtureManagedIdentityId(source.slug),
	hostLoginAlias: 'ayrin_samantha_lerma_castro',
	assetDir: 'src/assets/images/events/xv-ayrin-samantha-lerma-castro',
	assetFiles: {
		hero: 'remote-hero.webp', heroMobile: 'remote-hero-mobile.webp', portrait: 'portrait.webp',
		gallery02: 'gallery-02.webp', gallery03: 'gallery-03.webp', gallery04: 'gallery-04.webp',
		gallery06: 'gallery-06.webp', gallery08: 'gallery-08.webp', gallery10: 'gallery-10.webp',
		interlude01: 'interlude-01.webp', interlude02: 'interlude-02.webp', interlude03: 'interlude-03.webp', mapCeremony: 'map-ceremony.webp',
		mapReception: 'map-reception.webp', thankYouPortrait: 'thank-you-portrait.webp',
	},
	assetIdToKey: {
		'ba417856-16e7-4808-9e03-2c84d17c069d': 'hero',
		'fad93470-1c8d-45ef-90c4-fab7d19b7912': 'heroMobile',
	},
});
