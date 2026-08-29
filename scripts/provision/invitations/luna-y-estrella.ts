import fixture from '../local-render-corpus/fixtures/luna-y-estrella.json' with { type: 'json' };
import {
	defineFixtureBackedInvitation,
	deriveFixtureManagedIdentityId,
} from './fixture-backed-definition.ts';
import type { LocalRenderCorpusFixture } from '../local-render-corpus/fixture-types.ts';

const source = fixture as LocalRenderCorpusFixture;

export const lunaInvitation = defineFixtureBackedInvitation({
	fixture: source,
	managedIdentityId: deriveFixtureManagedIdentityId(source.slug),
	hostLoginAlias: 'luna_y_estrella',
	assetDir: 'src/assets/images/events/luna-y-estrella-primera-comunion',
	assetFiles: {
		hero: 'hero.webp', heroMobile: 'hero.webp', family: 'family.webp', thankYouPortrait: 'thank-you.webp',
	},
	assetIdToKey: {
		'869fb59d-96d3-4e42-9589-141e0bbc315e': 'hero',
		'c9e50184-6936-4177-9094-b789aeb9048b': 'family',
	},
});
