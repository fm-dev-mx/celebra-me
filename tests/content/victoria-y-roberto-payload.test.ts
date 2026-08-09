import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptEvent } from '@/lib/adapters/event';
import { buildInvitationRenderPlan } from '@/lib/invitation/render-plan';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import fs from 'node:fs';
import path from 'node:path';
import {
	VICTORIA_ASSET_SPECS,
	VICTORIA_EVENT,
	buildVictoriaPublishedContent,
	type VictoriaAssetMap,
} from '../../scripts/provision/invitations/victoria-y-roberto.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

const profilePath = path.join(
	process.cwd(),
	'src/styles/invitation-profiles/victoria-y-roberto.scss',
);

const assetDir = path.join(process.cwd(), 'src/assets/invitations/victoria-y-roberto');

function buildTestAssets(): VictoriaAssetMap {
	return Object.fromEntries(
		VICTORIA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as VictoriaAssetMap;
}

describe('Boda Victoria y Roberto provision contract', () => {
	it('registers the managed definition with jewelry-box catalog identity', () => {
		const definition = getInvitationDefinition('victoria-y-roberto');
		expect(definition.slug).toBe('victoria-y-roberto');
		expect(definition.hostLoginAlias).toBe('victoria_armenta');
		expect(definition.baseDemoId).toBe('demo-boda-jewelry-box-wedding');
		expect(definition.themeId).toBe('jewelry-box-wedding');
		expect(definition.visualProfileId).toBe('victoria-y-roberto');
		expect(definition.eventTiming.timeZone).toBe('America/Mazatlan');

		const preset = findDemoPreset(VICTORIA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-boda-jewelry-box-wedding',
			eventType: 'boda',
			themeId: 'jewelry-box-wedding',
		});
		expect(
			checkPublishGuard({
				baseDemoId: VICTORIA_EVENT.baseDemoId,
				themeId: VICTORIA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('ships a Lane A terracotta profile scoped to jewelry-box-wedding', () => {
		const profile = fs.readFileSync(profilePath, 'utf8');
		expect(profile).toContain('.event--victoria-y-roberto.theme-preset--jewelry-box-wedding');
		expect(profile).toContain('--victoria-terracota');
		expect(profile).toContain('--victoria-cream');
		expect(profile).toContain('--victoria-gold');
		expect(profile).toContain('--victoria-font-display');
		expect(profile).toContain("data-intersection='overlap'");
		expect(profile).toContain("data-reveal-state='sealed'");
		expect(profile).toContain("data-reveal-state='revealed'");
		expect(profile).toContain("data-variant='single'");
		expect(profile).not.toContain("data-presentation='text-only'");
		expect(profile).not.toContain('OneDrive');
		expect(profile).not.toContain('Clientes\\');
	});

	it('has source and derivative files for every declared asset path plus preserved originals', () => {
		const uniquePaths = new Set(VICTORIA_ASSET_SPECS.map((spec) => spec.relativePath));
		for (const relativePath of uniquePaths) {
			expect(fs.existsSync(path.join(assetDir, relativePath))).toBe(true);
		}
		for (const sourceName of [
			'hero-source.jpg',
			'gallery-01-source.jpg',
			'interlude-01-source.jpg',
			'interlude-02-source.jpg',
			'thank-you-source.jpg',
		]) {
			expect(fs.existsSync(path.join(assetDir, sourceName))).toBe(true);
		}
	});

	it('keeps five unique photograph roles without family media', () => {
		const keys = VICTORIA_ASSET_SPECS.map((spec) => spec.key);
		expect(keys).toEqual([
			'hero-desktop',
			'hero-mobile',
			'gallery-01',
			'interlude-01',
			'interlude-02',
			'thank-you',
		]);
		expect(keys).not.toContain('family');
		const uniqueSources = new Set(
			VICTORIA_ASSET_SPECS.filter((spec) => !spec.key.startsWith('hero-')).map(
				(spec) => spec.relativePath,
			),
		);
		expect(uniqueSources.size).toBe(4);
		expect(
			VICTORIA_ASSET_SPECS.filter((s) => s.key.startsWith('hero-')).every((s) =>
				s.relativePath.startsWith('hero-'),
			),
		).toBe(true);
	});

	it('builds schema-valid published content with Victoria structural contracts', () => {
		const content = buildVictoriaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);
		if (!result.success) {
			console.error(result.error.issues);
		}

		expect(content.isDemo).toBe(false);
		expect(content.templateId).toBe('boda-jewelry-box-wedding');
		expect(content._assetSlug).toBe('victoria-y-roberto');
		expect(content._assetSlug).not.toBe('demo-boda-jewelry-box-wedding');
		expect((content.theme as { preset: string }).preset).toBe('jewelry-box-wedding');
		expect((content.eventTiming as { timeZone: string }).timeZone).toEqual(expect.any(String));

		expect(content.sectionOrder).toEqual([
			'quote',
			'countdown',
			'location',
			'itinerary',
			'family',
			'gallery',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		]);
		expect(content).toHaveProperty('itinerary');
		expect(content).not.toHaveProperty('music');

		const hero = content.hero as { name: string; secondaryName: string };
		expect(hero.name.trim()).not.toBe('');
		expect(hero.secondaryName.trim()).not.toBe('');

		const envelope = content.envelope as { sealInitials?: string; envelopeName?: string };
		expect(envelope.sealInitials?.trim()).not.toBe('');
		expect(envelope.envelopeName?.trim()).not.toBe('');

		const quote = content.quote as { text: string; author: string };
		expect(quote.text.trim()).not.toBe('');
		expect(quote.author.trim()).not.toBe('');

		const location = content.location as {
			venues?: Array<{
				type: string;
				venueName: string;
				time: string;
				googleMapsUrl?: string;
				mapUrl?: string;
			}>;
		};
		expect(location.venues).toEqual(expect.any(Array));
		expect(location.venues?.length).toBeGreaterThan(0);
		expect(
			location.venues?.every(
				(venue) =>
					typeof venue.type === 'string' &&
					venue.type.trim().length > 0 &&
					typeof venue.venueName === 'string' &&
					venue.venueName.trim().length > 0 &&
					typeof venue.time === 'string' &&
					venue.time.trim().length > 0,
			),
		).toBe(true);

		const itinerary = content.itinerary as {
			items: Array<{ label: string; time: string }>;
		};
		expect(itinerary.items).toEqual(expect.any(Array));
		expect(itinerary.items.length).toBeGreaterThan(0);
		expect(
			itinerary.items.every(
				(item) =>
					typeof item.label === 'string' &&
					item.label.trim().length > 0 &&
					typeof item.time === 'string' &&
					item.time.trim().length > 0,
			),
		).toBe(true);

		const family = content.family as {
			presentation?: string;
			featuredImage?: unknown;
			groups?: Array<{ title: string; items: Array<{ name: string }> }>;
			godparents?: Array<{ name: string; role?: string }>;
		};
		expect(family.presentation).toBe('text-only');
		expect(family.featuredImage).toBeUndefined();
		expect(family.groups).toEqual(expect.any(Array));
		expect(
			family.groups?.every(
				(group) =>
					typeof group.title === 'string' &&
					group.items.every(
						(item) => typeof item.name === 'string' && item.name.trim().length > 0,
					),
			),
		).toBe(true);
		expect(family.godparents).toEqual(expect.any(Array));
		expect(
			family.godparents?.every(
				(godparent) =>
					typeof godparent.name === 'string' && godparent.name.trim().length > 0,
			),
		).toBe(true);

		const gallery = content.gallery as {
			variant?: string;
			items: unknown[];
		};
		expect(gallery.items).toEqual(expect.any(Array));
		expect(gallery.variant).toBe('single');

		const gifts = content.gifts as {
			items?: Array<{ type: string; title: string; url?: string }>;
		};
		expect(gifts.items).toEqual(expect.any(Array));
		expect(
			gifts.items?.every(
				(item) =>
					typeof item.type === 'string' &&
					item.type.trim().length > 0 &&
					typeof item.title === 'string' &&
					item.title.trim().length > 0,
			),
		).toBe(true);

		const rsvp = content.rsvp as {
			confirmationMode?: string;
			accessMode?: string;
			whatsappConfig?: unknown;
			personalizedAccess?: { noteText?: string };
		};
		expect(rsvp.confirmationMode).toBe('api');
		expect(rsvp.accessMode).toBe('hybrid');
		expect(rsvp.whatsappConfig).toBeUndefined();
		expect(rsvp.personalizedAccess?.noteText).toContain('{count}');

		const interludes = content.interludes as Array<{ afterSection: string }>;
		expect(interludes).toHaveLength(2);
		expect(interludes.map((item) => item.afterSection)).toEqual(['countdown', 'gifts']);

		const thankYou = content.thankYou as {
			image?: unknown;
			closingName?: string;
		};
		expect(thankYou.image).toBeDefined();
		expect(thankYou.closingName?.trim()).not.toBe('');

		const viewModel = adaptEvent({
			id: 'events/victoria-y-roberto',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		const renderPlan = buildInvitationRenderPlan(viewModel);
		expect(renderPlan.filter((item) => item.type === 'interlude')).toHaveLength(2);
		expect(
			renderPlan.filter((item) => item.type === 'interlude').map((item) => item.intersection),
		).toEqual([
			{ family: 'overlap', source: 'countdown' },
			{ family: 'overlap', source: 'gifts' },
		]);
		expect(
			renderPlan.find((item) => item.type === 'personalized-access')?.intersection,
		).toEqual({
			family: 'atmospheric-blend',
			source: 'interlude-after-gifts',
		});
		expect(
			renderPlan.find((item) => item.type === 'section' && item.section === 'rsvp')
				?.intersection,
		).toEqual({
			family: 'atmospheric-blend',
			source: 'personalized-access',
		});
		expect(
			renderPlan.map((item) => (item.type === 'section' ? item.section : item.type)),
		).toEqual([
			'quote',
			'countdown',
			'interlude',
			'location',
			'itinerary',
			'family',
			'gallery',
			'gifts',
			'interlude',
			'personalized-access',
			'rsvp',
			'thankYou',
		]);

		const serialized = JSON.stringify(content);
		expect(serialized).not.toMatch(/OneDrive|Clientes\\/i);
	});

	it('keeps Lane A hero focals synchronized between provision content and profile CSS', () => {
		const content = buildVictoriaPublishedContent(buildTestAssets());
		const hero = content.hero as {
			focalPoint: string;
			focalPointMobile: string;
			focalPointTablet: string;
			focalPointDesktop: string;
		};
		const profile = fs.readFileSync(profilePath, 'utf8');

		expect(hero.focalPoint).toBe('50% 34%');
		expect(hero.focalPointMobile).toBe('46% 27%');
		expect(hero.focalPointTablet).toBe('50% 34%');
		expect(hero.focalPointDesktop).toBe('49% 35%');

		expect(profile).toContain('--hero-focal-point-default: 50% 34%');
		expect(profile).toContain('--hero-focal-point-mobile: 46% 27%');
		expect(profile).toContain('--hero-focal-point-tablet: 50% 34%');
		expect(profile).toContain('--hero-focal-point-desktop: 49% 35%');

		const desktopAsset = VICTORIA_ASSET_SPECS.find((spec) => spec.key === 'hero-desktop');
		expect(desktopAsset?.focalPoint).toMatchObject({
			default: hero.focalPoint,
			mobile: hero.focalPointMobile,
			tablet: hero.focalPointTablet,
			desktop: hero.focalPointDesktop,
		});
	});

	it('keys the first invitation section handoff to source=hero without encoding a fixed successor', () => {
		const content = buildVictoriaPublishedContent(buildTestAssets());
		const viewModel = adaptEvent({
			id: 'events/victoria-y-roberto',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		const renderPlan = buildInvitationRenderPlan(viewModel);
		const firstSection = renderPlan.find((item) => item.type === 'section');

		expect(firstSection).toMatchObject({
			type: 'section',
			section: 'quote',
			intersection: { family: 'atmospheric-blend', source: 'hero' },
		});

		const profile = fs.readFileSync(profilePath, 'utf8');
		expect(profile).toContain("data-intersection-source='hero'");
		expect(profile).not.toContain("data-section-kind='quote'][data-intersection-source='hero'");
	});
});
