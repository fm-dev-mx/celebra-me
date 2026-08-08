import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptEvent } from '@/lib/adapters/event';
import { resolveVenueMapPreviewUrl } from '@/lib/invitation/location-helper';
import { buildInvitationRenderPlan } from '@/lib/invitation/render-plan';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import fs from 'node:fs';
import path from 'node:path';
import {
	VICTORIA_ASSET_SPECS,
	VICTORIA_EVENT,
	VICTORIA_PLACEHOLDERS,
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
		expect(profile).toContain("data-reveal-state='sealed'");
		expect(profile).toContain("data-reveal-state='revealed'");
		expect(profile).toContain("data-variant='single'");
		expect(profile).toContain("data-presentation='text-only'");
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
		expect((content.eventTiming as { timeZone: string }).timeZone).toBe('America/Mazatlan');

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
		expect(hero.name).toBe('Victoria');
		expect(hero.secondaryName).toBe('Roberto');

		const envelope = content.envelope as { sealInitials?: string; envelopeName?: string };
		expect(envelope.sealInitials).toBe('V·R');
		expect(envelope.envelopeName).toBe('Victoria & Roberto');

		const quote = content.quote as { text: string; author: string };
		expect(quote.author).toMatch(/Eclesiastés\s*4:9/i);
		expect(quote.text).not.toMatch(/Rut/i);

		const location = content.location as {
			venues?: Array<{
				type: string;
				venueName: string;
				time: string;
				googleMapsUrl?: string;
				mapUrl?: string;
			}>;
		};
		expect(location.venues).toHaveLength(2);
		expect(location.venues?.[0]).toMatchObject({
			type: 'ceremony',
			venueName: 'Parroquia Santo Niño',
			time: '19:00',
			googleMapsUrl: VICTORIA_PLACEHOLDERS.ceremonyMapUrl,
		});
		expect(location.venues?.[1]).toMatchObject({
			type: 'reception',
			venueName: 'Eventos Platinum LM',
			time: '21:00',
			googleMapsUrl: VICTORIA_PLACEHOLDERS.receptionMapUrl,
		});
		expect(resolveVenueMapPreviewUrl(location.venues![0]!)).toBeUndefined();
		expect(resolveVenueMapPreviewUrl(location.venues![1]!)).toBeUndefined();

		const itinerary = content.itinerary as {
			items: Array<{ label: string; time: string }>;
		};
		expect(itinerary.items.map((item) => item.label)).toEqual([
			'Ceremonia religiosa',
			'Recepción',
			'Cena',
			'Brindis',
			'Cierre de celebración',
		]);
		expect(itinerary.items.map((item) => item.time)).toEqual([
			'19:00',
			'21:00',
			VICTORIA_PLACEHOLDERS.dinnerTime,
			VICTORIA_PLACEHOLDERS.toastTime,
			VICTORIA_PLACEHOLDERS.closingTime,
		]);
		expect(
			itinerary.items.some((item) =>
				/cóctel|vals|primer baile|after party/i.test(item.label),
			),
		).toBe(false);

		const family = content.family as {
			presentation?: string;
			featuredImage?: unknown;
			groups?: Array<{ title: string; items: Array<{ name: string }> }>;
			godparents?: Array<{ name: string; role?: string }>;
		};
		expect(family.presentation).toBe('text-only');
		expect(family.featuredImage).toBeUndefined();
		expect(family.groups?.[0]?.items.map((item) => item.name)).toEqual([
			'Argelia Valdez',
			'Victor Armenta',
		]);
		expect(family.groups?.[1]?.items.map((item) => item.name)).toEqual([
			'Socorro Palomares',
			'Nicolas Luviano',
		]);
		expect(family.godparents?.map((g) => g.name)).toEqual(['Eric Montes', 'Rosario Soto']);
		expect(family.godparents?.some((g) => /velación/i.test(g.role ?? ''))).toBe(false);

		const gallery = content.gallery as {
			variant?: string;
			items: unknown[];
		};
		expect(gallery.items).toHaveLength(1);
		expect(gallery.variant).toBe('single');

		const gifts = content.gifts as {
			items?: Array<{ type: string; title: string; url?: string }>;
		};
		expect(gifts.items).toHaveLength(1);
		expect(gifts.items?.[0]).toMatchObject({ type: 'cash', title: 'Lluvia de sobres' });
		expect(gifts.items?.some((item) => item.url || /liverpool|amazon/i.test(item.title))).toBe(
			false,
		);

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
		expect(thankYou.closingName).toBe('Victoria & Roberto');

		const viewModel = adaptEvent({
			id: 'events/victoria-y-roberto',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		const renderPlan = buildInvitationRenderPlan(viewModel);
		expect(renderPlan.filter((item) => item.type === 'interlude')).toHaveLength(2);
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
		expect(serialized).toContain(VICTORIA_PLACEHOLDERS.ceremonyMapUrl);
		expect(serialized).toContain(VICTORIA_PLACEHOLDERS.receptionMapUrl);
		expect(serialized).toContain(VICTORIA_PLACEHOLDERS.dinnerTime);
		expect(serialized).toContain(VICTORIA_PLACEHOLDERS.toastTime);
		expect(serialized).toContain(VICTORIA_PLACEHOLDERS.closingTime);
		expect((serialized.match(/\[\[PENDIENTE:/g) ?? []).length).toBe(5);
		expect(serialized).not.toMatch(/Sof[ií]a|Alejandro|Puebla|Liverpool|Rut 1:16/i);
		expect(serialized).not.toMatch(/OneDrive|Clientes\\/i);
		expect(serialized).not.toMatch(/padrinos de velaci[oó]n/i);
	});
});
