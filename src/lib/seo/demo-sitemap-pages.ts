import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Short addresses (`/celestial`) of the demos the showroom features, for the sitemap. Demo pages
 * render on request, so the sitemap integration cannot discover them. Read from the demo
 * definitions on disk because astro.config cannot resolve the `@/` imports of the demo catalog; a
 * unit test keeps this list equal to the catalog's featured, approved demos. Hidden demos stay out.
 */
export function listFeaturedDemoRouteSlugs(demosDir: string): string[] {
	return readdirSync(demosDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((entry) => {
			let source: string;
			try {
				source = readFileSync(join(demosDir, entry.name, 'invitation.ts'), 'utf8');
			} catch {
				return [];
			}
			const routeSlug = source.match(/routeSlug:\s*'([^']+)'/)?.[1];
			const featured = /visibility:\s*'featured'/.test(source);
			const approved = /reviewStatus:\s*'approved'/.test(source);
			return routeSlug && featured && approved ? [routeSlug] : [];
		})
		.sort();
}

export function buildDemoSitemapPages(site: string, demosDir: string): string[] {
	return listFeaturedDemoRouteSlugs(demosDir).map(
		(routeSlug) => new URL(`/${routeSlug}`, site).href,
	);
}
