import fixture from '../local-render-corpus/fixtures/cesar-ramses.json' with { type: 'json' };
import {
	defineFixtureBackedInvitation,
	deriveFixtureManagedIdentityId,
} from './fixture-backed-definition.ts';
import type { LocalRenderCorpusFixture } from '../local-render-corpus/fixture-types.ts';

const source = fixture as LocalRenderCorpusFixture;

export const cesarInvitation = defineFixtureBackedInvitation({
	fixture: source,
	managedIdentityId: deriveFixtureManagedIdentityId(source.slug),
	hostLoginAlias: 'cesar_ramses',
	assetDir: 'src/assets/images/events/cesar-ramses',
	assetFiles: {
		hero: 'hero.webp', heroMobile: 'hero.webp', thankYouPortrait: 'thank-you.webp',
		family: 'family.webp', reception: 'reception.webp',
		gallery01: 'gallery-01.webp', gallery02: 'gallery-02.webp', gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp', gallery05: 'gallery-05.webp', gallery06: 'gallery-06.webp',
	},
	assetIdToKey: {
		'ff5f596c-422b-4bfc-8954-85733fb9f68f': 'hero',
		'b6d30e2a-cbed-4eed-8335-710105cdaa52': 'heroMobile',
		'a1b640d8-7c3a-4a99-b947-cc3da7bed101': 'thankYouPortrait',
	},
});
