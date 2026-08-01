/**
 * Screenshot completeness pages derived from the Local Render Corpus SSOT.
 */
import type { ScreenshotConfig, ScreenshotConfigPage } from '../../screenshot/types.ts';
import {
	corpusPublicRoute,
	listLocalRenderCorpus,
	type LocalRenderCorpusEntry,
} from './registry.ts';

export function buildCorpusScreenshotPages(
	entries: readonly LocalRenderCorpusEntry[] = listLocalRenderCorpus(),
): ScreenshotConfigPage[] {
	return entries.map((entry) => ({
		name: entry.slug,
		pageType: 'invitation' as const,
		route: corpusPublicRoute(entry),
		target: 'all-sections' as const,
		sectionCapture: 'known' as const,
		revealHandling: 'force-open' as const,
		viewports: ['mobile-standard'],
	}));
}

export function buildCorpusScreenshotConfig(): ScreenshotConfig {
	return {
		outputDir: 'output/screenshots/local-render-corpus',
		pages: buildCorpusScreenshotPages(),
	};
}
