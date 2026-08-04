import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import fs from 'node:fs';
import path from 'node:path';
import {
	PERLA_ASSET_SPECS,
	PERLA_EVENT,
	buildPerlaPublishedContent,
	type PerlaAssetMap,
} from '../../scripts/provision/invitations/boda-perla-y-carlos.ts';

const profilePath = path.join(
	process.cwd(),
	'src/styles/invitation-profiles/boda-perla-y-carlos.scss',
);

const assetDir = path.join(process.cwd(), 'src/assets/invitations/boda-perla-y-carlos');

function buildTestAssets(): PerlaAssetMap {
	return Object.fromEntries(
		PERLA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as PerlaAssetMap;
}

describe('Boda Perla y Carlos provision contract', () => {
	it('uses jewelry-box-wedding catalog entry', () => {
		const preset = findDemoPreset(PERLA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-boda-jewelry-box-wedding',
			eventType: 'boda',
			themeId: 'jewelry-box-wedding',
		});
		expect(
			checkPublishGuard({
				baseDemoId: PERLA_EVENT.baseDemoId,
				themeId: PERLA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('ships a Lane A profile scoped to jewelry-box-wedding', () => {
		const profile = fs.readFileSync(profilePath, 'utf8');
		expect(profile).toContain('.event--boda-perla-y-carlos.theme-preset--jewelry-box-wedding');
		expect(profile).toContain('--perla-olive');
		expect(profile).toContain('--perla-gold');
		expect(profile).toContain('--pa-card-bg-image');
		expect(profile).toContain('--rsvp-bg');
		expect(profile).toContain("data-reveal-state='sealed'");
		expect(profile).toContain("data-reveal-state='letter-held'");
		expect(profile).toContain("data-reveal-state='preview-opened'");
		expect(profile).toContain("data-reveal-state='revealed'");
		expect(profile).toContain('invitation-hero__ampersand');
		expect(profile).toContain('event-location__heading');
		expect(profile).toContain('-webkit-text-fill-color: var(--perla-cream)');
		expect(profile).toMatch(/\.invitation-hero__title[\s\S]*background:\s*none/);
	});

	it('keeps Hero chrome hidden during sealed, letter-held, and preview-opened', () => {
		const profile = fs.readFileSync(profilePath, 'utf8');
		const hideBlock =
			profile.match(
				/&\[data-reveal-state='sealed'\][\s\S]*?&\[data-reveal-state='revealed'\]/,
			)?.[0] ?? '';
		expect(hideBlock).toContain("data-reveal-state='sealed'");
		expect(hideBlock).toContain("data-reveal-state='letter-held'");
		expect(hideBlock).toContain("data-reveal-state='preview-opened'");
		expect(hideBlock).toContain('opacity: 0%');
		expect(hideBlock).toContain('visibility: hidden');
	});

	it('shares one physical hero source across desktop and mobile specs', () => {
		const heroDesktop = PERLA_ASSET_SPECS.find((s) => s.key === 'hero-desktop');
		const heroMobile = PERLA_ASSET_SPECS.find((s) => s.key === 'hero-mobile');
		expect(heroDesktop?.relativePath).toBe('hero-source.jpg');
		expect(heroMobile?.relativePath).toBe('hero-source.jpg');
		expect(heroDesktop?.focalPoint).not.toEqual(heroMobile?.focalPoint);
		expect(fs.existsSync(path.join(assetDir, 'hero-source.jpg'))).toBe(true);
		expect(fs.existsSync(path.join(assetDir, 'hero-mobile-source.jpg'))).toBe(false);
	});

	it('has source files for every declared asset path', () => {
		const uniquePaths = new Set(PERLA_ASSET_SPECS.map((spec) => spec.relativePath));
		for (const relativePath of uniquePaths) {
			expect(fs.existsSync(path.join(assetDir, relativePath))).toBe(true);
		}
	});

	it('builds schema-valid published content with OD2 structural contracts', () => {
		const content = buildPerlaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);
		if (!result.success) {
			console.error(result.error.issues);
		}

		expect(content.sectionOrder).toEqual([
			'quote',
			'countdown',
			'location',
			'family',
			'gallery',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		]);
		expect(content).toHaveProperty('family');
		expect(content).not.toHaveProperty('gifts');
		expect(content).not.toHaveProperty('music');
		expect(content).not.toHaveProperty('itinerary');
		expect(content).not.toHaveProperty('interludes');

		const envelope = content.envelope as {
			microcopy?: string;
			tooltipText?: string;
			envelopeName?: string;
		};
		expect(envelope.microcopy).toBe('');
		expect(envelope.tooltipText).toBe('Toque el sello');
		expect(envelope.envelopeName).toBe('Perla & Carlos');

		const location = content.location as {
			venues?: Array<{
				type: string;
				venueName: string;
				time: string;
				googleMapsUrl?: string;
			}>;
			ceremony?: unknown;
			reception?: unknown;
			indications?: Array<{ text: string }>;
			indicationsHeading?: string;
			introHeading?: string;
		};
		expect(location.ceremony).toBeUndefined();
		expect(location.reception).toBeUndefined();
		expect(location.venues).toHaveLength(2);
		expect(location.venues?.[0]).toMatchObject({
			type: 'ceremony',
			venueName: 'Catedral de Cristo Rey',
			time: '5:30 p. m.',
			googleMapsUrl: expect.stringContaining('maps.app.goo.gl'),
		});
		expect(location.venues?.[1]).toMatchObject({
			type: 'reception',
			venueName: 'Salón El Pedregal',
			time: '7:30 p. m.',
			googleMapsUrl: expect.stringContaining('maps.app.goo.gl'),
		});
		expect(location.venues?.[0]?.googleMapsUrl).not.toBe(location.venues?.[1]?.googleMapsUrl);
		expect(location.introHeading).toBe('Sábado, 28 de noviembre de 2026');
		expect(location.indicationsHeading).toBe('Indicaciones');
		expect(location.indications?.some((i) => /ceremonia civil/i.test(i.text))).toBe(true);
		expect(location.indications?.some((i) => /8:15 p\. m\./.test(i.text))).toBe(true);

		const family = content.family as {
			presentation?: string;
			groups?: Array<{ title: string; items: Array<{ name: string }> }>;
			labels?: { sectionSubtitle?: string; sectionTitle?: string };
		};
		expect(family.presentation).toBe('text-only');
		expect(family.labels?.sectionSubtitle).toBe('Familia');
		expect(family.groups).toHaveLength(2);
		expect(family.groups?.[0]?.title).toBe('Padres de la Novia');
		expect(family.groups?.[1]?.title).toBe('Padres del Novio');
		expect(
			family.groups?.every((group) =>
				group.items.every((item) => item.name === 'Por confirmar'),
			),
		).toBe(true);

		const gallery = content.gallery as {
			items: unknown[];
			subtitle?: string;
			title?: string;
		};
		expect(gallery.items).toHaveLength(1);
		expect(gallery.subtitle).not.toMatch(/fotos|galería de|colección/i);

		const rsvp = content.rsvp as {
			confirmationMode?: string;
			accessMode?: string;
		};
		expect(rsvp.confirmationMode).toBe('api');
		expect(rsvp.accessMode).toBe('hybrid');
		expect(content.sectionStyles).not.toHaveProperty('rsvp');

		const thankYou = content.thankYou as {
			image?: unknown;
			closingName?: string;
			date?: string;
		};
		expect(thankYou.image).toBeUndefined();
		expect(thankYou.closingName).toBe('Perla & Carlos');
		expect(thankYou.date).toBe('28 de noviembre de 2026');

		const serialized = JSON.stringify(content);
		expect(serialized).not.toMatch(/\[\[PENDIENTE:/);
		expect(serialized).toMatch(/Por confirmar/);
		expect(serialized).not.toMatch(/hero-mobile-source/);
	});
});
