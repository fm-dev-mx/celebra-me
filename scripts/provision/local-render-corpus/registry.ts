/**
 * Local Render Corpus SSOT — every currently supported Production client invitation
 * that must be reproducibly renderable and regression-tested in Local.
 *
 * Canonical managed lifecycle registry remains scripts/provision/invitations/registry.ts.
 * This corpus includes every published canonical definition plus supported legacy clients.
 * Canonical definitions marked in_progress are intentionally outside the Production corpus.
 */

export type CorpusClassification = 'canonical' | 'legacy';

export type CorpusSourceStrategy = 'canonical_definition' | 'sanitized_fixture';

/**
 * How invitation media is expected to be present for Local render regression.
 * - VERSIONED_MANAGED_ASSET: managed package assets under src/assets/invitations/{slug}
 * - VERSIONED_LOCAL_ASSET: fully local versioned assets (no remote media references)
 * - HYBRID_VERSIONED_AND_REMOTE: local inventory and/or fixture-referenced remote http(s) media
 */
export type CorpusAssetStrategy =
	'VERSIONED_MANAGED_ASSET' | 'VERSIONED_LOCAL_ASSET' | 'HYBRID_VERSIONED_AND_REMOTE';

export interface LocalRenderCorpusEntry {
	readonly slug: string;
	readonly eventType: string;
	readonly classification: CorpusClassification;
	/** Remote parity authority. Legacy exclusions must be explicit here. */
	readonly remoteParity: 'required' | 'excluded';
	readonly sourceStrategy: CorpusSourceStrategy;
	readonly assetStrategy: CorpusAssetStrategy;
	/** Optional profile / theme hints for documentation and coverage checks. */
	readonly themeId?: string;
	readonly visualProfileId?: string;
	/** Relative to scripts/provision/local-render-corpus/fixtures/ */
	readonly fixtureFile?: string;
}

export const LOCAL_RENDER_CORPUS: readonly LocalRenderCorpusEntry[] = [
	{
		slug: 'alba-rosa-quinonez',
		eventType: 'cumple',
		classification: 'canonical',
		remoteParity: 'required',
		sourceStrategy: 'canonical_definition',
		assetStrategy: 'VERSIONED_MANAGED_ASSET',
		themeId: 'luxury-hacienda',
		visualProfileId: 'alba-rosa-quinonez',
	},
	{
		slug: 'abril-michelle-becerra-rea',
		eventType: 'xv',
		classification: 'canonical',
		remoteParity: 'required',
		sourceStrategy: 'canonical_definition',
		assetStrategy: 'VERSIONED_MANAGED_ASSET',
		themeId: 'premiere-floral',
		visualProfileId: 'abril-michelle-becerra-rea',
	},
	{
		slug: 'romina-rios-chaparro',
		eventType: 'xv',
		classification: 'canonical',
		remoteParity: 'required',
		sourceStrategy: 'canonical_definition',
		assetStrategy: 'VERSIONED_MANAGED_ASSET',
		themeId: 'premiere-floral',
		visualProfileId: 'romina-rios-chaparro',
	},
	{
		slug: 'daniela-y-martin',
		eventType: 'boda',
		classification: 'canonical',
		remoteParity: 'required',
		sourceStrategy: 'canonical_definition',
		assetStrategy: 'VERSIONED_MANAGED_ASSET',
		themeId: 'jewelry-box-wedding',
		visualProfileId: 'daniela-y-martin',
	},
	{
		slug: 'victoria-y-roberto',
		eventType: 'boda',
		classification: 'canonical',
		remoteParity: 'required',
		sourceStrategy: 'canonical_definition',
		assetStrategy: 'VERSIONED_MANAGED_ASSET',
		themeId: 'jewelry-box-wedding',
		visualProfileId: 'victoria-y-roberto',
	},
	{
		slug: 'america-johana',
		eventType: 'xv',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		themeId: 'celestial-blue',
		visualProfileId: 'america-johana',
		fixtureFile: 'america-johana.json',
	},
	{
		slug: 'valentina-hernandez',
		eventType: 'xv',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		themeId: 'editorial-magazine',
		visualProfileId: 'valentina-hernandez',
		fixtureFile: 'valentina-hernandez.json',
	},
	{
		slug: 'xareni-iyarit',
		eventType: 'xv',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		themeId: 'celestial-blue',
		visualProfileId: 'xareni-iyarit',
		fixtureFile: 'xareni-iyarit.json',
	},
	{
		slug: 'leah-lexa',
		eventType: 'baby-shower',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		themeId: 'celestial-blue',
		visualProfileId: 'leah-lexa',
		fixtureFile: 'leah-lexa.json',
	},
	{
		slug: 'luna-y-estrella',
		eventType: 'primera-comunion',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		themeId: 'angelic-presence',
		visualProfileId: 'luna-y-estrella',
		fixtureFile: 'luna-y-estrella.json',
	},
	{
		slug: 'cesar-ramses',
		eventType: 'bautizo',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		themeId: 'sacred-keepsake',
		fixtureFile: 'cesar-ramses.json',
	},
	{
		slug: 'ayrin-samantha-lerma-castro',
		eventType: 'xv',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		themeId: 'enchanted-rose',
		fixtureFile: 'ayrin-samantha-lerma-castro.json',
	},
	{
		slug: 'ana-sofia-cota-guillen',
		eventType: 'xv',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		/** Render-effective content theme (invitations.theme_id may still say jewelry-box). */
		themeId: 'celestial-blue',
		fixtureFile: 'ana-sofia-cota-guillen.json',
	},
	{
		slug: 'ximena-meza-trasvina',
		eventType: 'xv',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		/** Render-effective content theme (invitations.theme_id may still say jewelry-box). */
		themeId: 'premiere-floral',
		fixtureFile: 'ximena-meza-trasvina.json',
	},
	{
		slug: 'gerardo-sesenta',
		eventType: 'cumple',
		classification: 'legacy',
		remoteParity: 'excluded',
		sourceStrategy: 'sanitized_fixture',
		assetStrategy: 'HYBRID_VERSIONED_AND_REMOTE',
		/** Render-effective content theme (invitations.theme_id may still say jewelry-box). */
		themeId: 'luxury-hacienda',
		fixtureFile: 'gerardo-sesenta.json',
	},
] as const;

export const EXPECTED_LOCAL_RENDER_CORPUS_SIZE = 15;

export function listLocalRenderCorpus(): readonly LocalRenderCorpusEntry[] {
	return LOCAL_RENDER_CORPUS;
}

export function listLegacyCorpusSlugs(): string[] {
	return LOCAL_RENDER_CORPUS.filter((e) => e.classification === 'legacy').map((e) => e.slug);
}

export function corpusPublicRoute(entry: LocalRenderCorpusEntry): string {
	return `/${entry.eventType}/${entry.slug}`;
}

export function assertLocalRenderCorpusIntegrity(): void {
	if (LOCAL_RENDER_CORPUS.length !== EXPECTED_LOCAL_RENDER_CORPUS_SIZE) {
		throw new Error(
			`Local Render Corpus must contain exactly ${EXPECTED_LOCAL_RENDER_CORPUS_SIZE} supported Production clients (found ${LOCAL_RENDER_CORPUS.length}).`,
		);
	}
	const slugs = new Set<string>();
	const identities = new Set<string>();
	const routes = new Set<string>();
	for (const entry of LOCAL_RENDER_CORPUS) {
		if (slugs.has(entry.slug)) {
			throw new Error(`Duplicate Local Render Corpus slug: ${entry.slug}`);
		}
		slugs.add(entry.slug);
		if (
			!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(entry.eventType) ||
			!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(entry.slug)
		) {
			throw new Error(
				`Local Render Corpus entry ${entry.slug} has an unsafe route identity.`,
			);
		}
		const identity = `${entry.eventType.toLowerCase()}/${entry.slug.toLowerCase()}`;
		const route = corpusPublicRoute(entry);
		if (identities.has(identity) || routes.has(route.toLowerCase())) {
			throw new Error(`Duplicate Local Render Corpus route or identity: ${route}`);
		}
		identities.add(identity);
		routes.add(route.toLowerCase());
		if (entry.sourceStrategy === 'sanitized_fixture' && !entry.fixtureFile) {
			throw new Error(`Legacy corpus entry ${entry.slug} requires fixtureFile.`);
		}
		if (!entry.assetStrategy) {
			throw new Error(`Corpus entry ${entry.slug} requires assetStrategy.`);
		}
		if (
			(entry.classification === 'legacy' && entry.remoteParity !== 'excluded') ||
			(entry.classification === 'canonical' && entry.remoteParity !== 'required')
		) {
			throw new Error(`Corpus entry ${entry.slug} has contradictory remote parity metadata.`);
		}
		if (entry.slug.startsWith('demo-') || entry.slug === 'e2e-preview-publication') {
			throw new Error(
				`Excluded slug incorrectly registered in Local Render Corpus: ${entry.slug}`,
			);
		}
	}
}
