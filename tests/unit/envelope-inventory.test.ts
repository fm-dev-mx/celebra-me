import fs from 'node:fs';
import path from 'node:path';
import { resolveSealPresentation, type SealRendererType } from '@/lib/invitation/reveal-card';

interface EnvelopeContentConfig {
	showEnvelope?: boolean;
	sealStyle?: 'wax' | 'ribbon' | 'flower' | 'monogram';
	sealIcon?: string;
	sealVariant?: string;
	sealInitials?: string;
	sealImage?: string;
}

interface RawEventJson {
	id?: string;
	slug?: string;
	eventType?: string;
	showEnvelope?: boolean;
	envelope?: EnvelopeContentConfig;
}

export interface DiscoveredEnvelopeRoute {
	route: string;
	slug: string;
	eventType: string;
	sourceFile: string;
	renderer: SealRendererType;
	skin?: string;
	hasRasterImage: boolean;
}

export function discoverCanonicalEnvelopeRoutes(): DiscoveredEnvelopeRoute[] {
	const contentDir = path.resolve('src/content');
	const routes: DiscoveredEnvelopeRoute[] = [];

	function scanDirectory(dir: string) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				scanDirectory(fullPath);
			} else if (entry.isFile() && entry.name.endsWith('.json')) {
				try {
					const content: RawEventJson = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
					const showEnvelope = content.showEnvelope ?? content.envelope?.showEnvelope ?? true;
					if (!showEnvelope) continue;

					const slug = content.slug || path.basename(entry.name, '.json');
					const eventType = content.eventType || 'xv';

					// Resolve presentation
					const presentation = resolveSealPresentation({
						sealStyle: content.envelope?.sealStyle,
						sealIcon: content.envelope?.sealIcon as any,
						sealInitials: content.envelope?.sealInitials,
						sealVariant: content.envelope?.sealVariant,
						sealImage: content.envelope?.sealImage ? { src: content.envelope.sealImage, alt: 'Sello' } : undefined,
					});

					routes.push({
						route: `/${eventType}/${slug}?forceEnvelope=true`,
						slug,
						eventType,
						sourceFile: path.relative(process.cwd(), fullPath),
						renderer: presentation.renderer,
						skin: presentation.skin,
						hasRasterImage: Boolean(content.envelope?.sealImage),
					});
				} catch (err) {
					console.warn(`[Inventory] Could not parse ${fullPath}:`, err);
				}
			}
		}
	}

	scanDirectory(contentDir);
	return routes;
}

describe('Canonical Envelope Route Inventory Audit', () => {
	const inventory = discoverCanonicalEnvelopeRoutes();

	it('discovers all canonical demo and template routes with enabled envelopes', () => {
		expect(inventory.length).toBeGreaterThan(0);
		// Confirm key routes are present
		const slugs = inventory.map((i) => i.slug);
		expect(slugs).toContain('demo-baby-shower-celestial');
		expect(slugs).toContain('demo-xv-enchanted-rose');
		expect(slugs).toContain('demo-xv-celestial-blue');
		expect(slugs).toContain('demo-bautismo-angelic-presence');
		expect(slugs).toContain('demo-xv-jewelry-box');
	});

	it('assigns every inventoried route a valid renderer type', () => {
		const validRenderers: SealRendererType[] = ['raster', 'wax-organic', 'wax-medallion', 'monogram', 'vector-icon'];
		for (const route of inventory) {
			expect(validRenderers).toContain(route.renderer);
		}
	});

	it('validates that real client routes with raster seals resolve their image assets', () => {
		const leahLexaPng = path.resolve('src/assets/images/events/leah-lexa-baby-shower/rose-wax-seal-ll.png');
		const celestialWebp = path.resolve('src/assets/images/events/demo-baby-shower-celestial/rose-wax-seal-lc.webp');
		expect(fs.existsSync(leahLexaPng)).toBe(true);
		expect(fs.existsSync(celestialWebp)).toBe(true);
	});
});
