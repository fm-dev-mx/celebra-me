import fixture from '../local-render-corpus/fixtures/xareni-iyarit.json' with { type: 'json' };
import {
	defineFixtureBackedInvitation,
	deriveFixtureManagedIdentityId,
} from './fixture-backed-definition.ts';
import type { LocalRenderCorpusFixture } from '../local-render-corpus/fixture-types.ts';

const source = fixture as LocalRenderCorpusFixture;

export const xareniInvitation = defineFixtureBackedInvitation({
	fixture: source,
	managedIdentityId: deriveFixtureManagedIdentityId(source.slug),
	hostLoginAlias: 'xareni_iyarit',
	assetDir: 'src/assets/images/events/xv-xareni-iyarit',
	assetFiles: {
		hero: 'hero.webp', heroMobile: 'hero.webp', heroDesktop: 'hero-desktop.webp',
		family: 'family.webp', portrait: 'portrait.webp', thankYouPortrait: 'thank-you-portrait.webp',
		gallery01: 'gallery-01.webp', gallery02: 'gallery-02.webp', gallery03: 'gallery-03.webp',
		gallery04: 'gallery-04.webp', gallery05: 'gallery-05.webp', gallery06: 'gallery-06.webp',
		interlude01: 'interlude-01.webp', interlude02: 'interlude-02.webp',
		interlude03: 'interlude-03.webp', interlude04: 'interlude-04.webp',
	},
	assetIdToKey: {
		'5a9dda61-b675-4b35-b5ed-552c09998461': 'hero',
		'707de417-7959-44af-a673-e4eff994d652': 'heroMobile',
	},
});
