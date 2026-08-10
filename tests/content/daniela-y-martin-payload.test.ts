import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptEvent } from '@/lib/adapters/event';
import { resolveLocationShowNavigationButtons } from '@/lib/invitation/presentation-options';
import { buildInvitationRenderPlan } from '@/lib/invitation/render-plan';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import demoBodaJewelryBoxWedding from '../../src/content/event-demos/boda/demo-boda-jewelry-box-wedding.json';
import fs from 'node:fs';
import path from 'node:path';
import {
	DANIELA_ASSET_SPECS,
	DANIELA_EVENT,
	buildDanielaPublishedContent,
	type DanielaAssetMap,
} from '../../scripts/provision/invitations/daniela-y-martin.ts';

const profilePath = path.join(
	process.cwd(),
	'src/styles/invitation-profiles/daniela-y-martin.scss',
);

const assetDir = path.join(process.cwd(), 'src/assets/invitations/daniela-y-martin');

function buildTestAssets(): DanielaAssetMap {
	return Object.fromEntries(
		DANIELA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as DanielaAssetMap;
}

describe('Boda Daniela y Martín provision contract', () => {
	it('uses jewelry-box-wedding catalog entry', () => {
		const preset = findDemoPreset(DANIELA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-boda-jewelry-box-wedding',
			eventType: 'boda',
			themeId: 'jewelry-box-wedding',
		});
		expect(
			checkPublishGuard({
				baseDemoId: DANIELA_EVENT.baseDemoId,
				themeId: DANIELA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('ships a Lane A profile scoped to jewelry-box-wedding', () => {
		const profile = fs.readFileSync(profilePath, 'utf8');
		expect(profile).toContain('.event--daniela-y-martin.theme-preset--jewelry-box-wedding');
		expect(profile).toContain('--daniela-olive');
		expect(profile).toContain('--daniela-gold');
		expect(profile).toContain('--pa-card-bg-image');
		expect(profile).toContain('--rsvp-bg');
		expect(profile).toContain('--daniela-countdown-padding-block');
		expect(profile).toContain('--daniela-location-card-gap');
		expect(profile).toContain("data-reveal-state='sealed'");
		expect(profile).toContain("data-reveal-state='letter-held'");
		expect(profile).toContain("data-reveal-state='preview-opened'");
		expect(profile).toContain("data-reveal-state='revealed'");
		// The ampersand is styled via SCSS nesting under `.invitation-hero`,
		// so the source contains the suffix `&__ampersand` (the SCSS compiler
		// resolves `&` to `.invitation-hero`).
		expect(profile).toMatch(/&__ampersand\s*\{[^}]*font-weight:\s*300/);
		expect(profile).toContain('event-location__heading');
		expect(profile).toContain('-webkit-text-fill-color: var(--daniela-cream)');
		// The title is styled via SCSS nesting; the source contains `&__title`
		// followed (anywhere in the block) by `background: none` to kill the
		// shared gradient/specular clip on the names.
		expect(profile).toMatch(/&__title\s*\{[^}]*?background:\s*none/);
		expect(profile).toContain('family__group--group-0');
		expect(profile).toContain('family__group--group-1');
		expect(profile).not.toContain('interlude-free');
		expect(profile).toMatch(/--env-bg:[\s\S]*var\(--daniela-sand\)/);
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
		const heroDesktop = DANIELA_ASSET_SPECS.find((s) => s.key === 'hero-desktop');
		const heroMobile = DANIELA_ASSET_SPECS.find((s) => s.key === 'hero-mobile');
		expect(heroDesktop?.relativePath).toBe('hero-source.jpg');
		expect(heroMobile?.relativePath).toBe('hero-source.jpg');
		expect(heroDesktop?.focalPoint).not.toEqual(heroMobile?.focalPoint);
		expect(fs.existsSync(path.join(assetDir, 'hero-source.jpg'))).toBe(true);
		expect(fs.existsSync(path.join(assetDir, 'hero-mobile-source.jpg'))).toBe(false);
	});

	it('has source files for every declared asset path', () => {
		const uniquePaths = new Set(DANIELA_ASSET_SPECS.map((spec) => spec.relativePath));
		for (const relativePath of uniquePaths) {
			expect(fs.existsSync(path.join(assetDir, relativePath))).toBe(true);
		}
	});

	it('builds schema-valid published content with OD2 structural contracts', () => {
		const content = buildDanielaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);
		if (!result.success) {
			console.error(result.error.issues);
		}

		expect(content.sectionOrder).toEqual([
			'quote',
			'countdown',
			'location',
			'personalizedAccess',
			'family',
			'gallery',
			'gifts',
			'rsvp',
			'thankYou',
		]);
		expect(content).toHaveProperty('family');
		expect(content).toHaveProperty('gifts');
		expect(content).not.toHaveProperty('music');
		expect(content).not.toHaveProperty('itinerary');

		const gifts = content.gifts as {
			title?: string;
			items?: Array<{ type: string; title: string; url?: string; text?: string }>;
		};
		expect(gifts.title).toBe('Mesa de regalos');
		expect(gifts.items).toEqual([
			expect.objectContaining({
				type: 'store',
				title: 'Amazon',
				url: 'https://www.amazon.com.mx/wedding/guest-view/30EX58RGSIPUM',
			}),
			expect.objectContaining({
				type: 'cash',
				title: 'Lluvia de sobres',
			}),
		]);

		const interludes = content.interludes as Array<{
			afterSection: string;
			image: unknown;
			alt?: string;
			height?: string;
			focalPoint?: string;
		}>;
		expect(interludes).toHaveLength(2);
		expect(interludes.map((interlude) => interlude.afterSection)).toEqual([
			'countdown',
			'gifts',
		]);
		expect(interludes).toEqual([
			expect.objectContaining({
				afterSection: 'countdown',
				alt: 'Arco de piedra con flores blancas al atardecer',
				height: 'screen',
				focalPoint: '50% 50%',
			}),
			expect.objectContaining({
				afterSection: 'gifts',
				alt: 'Mesa de recepción con flores blancas y luces cálidas',
				height: 'screen',
				focalPoint: '50% 58%',
			}),
		]);

		const viewModel = adaptEvent({
			id: 'events/daniela-y-martin',
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
			'personalized-access',
			'family',
			'gallery',
			'gifts',
			'interlude',
			'rsvp',
			'thankYou',
		]);
		expect(
			renderPlan.find(
				(item) => item.type === 'interlude' && item.afterSection === 'countdown',
			),
		).toMatchObject({
			intersection: { family: 'arch', source: 'countdown' },
		});
		expect(
			renderPlan.find((item) => item.type === 'interlude' && item.afterSection === 'gifts'),
		).toMatchObject({
			intersection: { family: 'atmospheric-blend', source: 'gifts' },
		});
		expect(renderPlan.find((item) => item.type === 'personalized-access')).toMatchObject({
			intersection: { family: 'overlap', source: 'location' },
		});

		const envelope = content.envelope as {
			microcopy?: string;
			tooltipText?: string;
			envelopeName?: string;
		};
		expect(envelope.microcopy).toBe('');
		expect(envelope.tooltipText).toBe('Abrir invitación');
		expect(envelope.envelopeName).toBe('Daniela & Martín');

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
		expect(location.indications?.some((i) => /recepción/i.test(i.text))).toBe(true);
		expect(location.indications?.some((i) => /8:15 p\. m\./.test(i.text))).toBe(true);

		const family = content.family as {
			presentation?: string;
			groups?: Array<{ title: string; items: Array<{ name: string }> }>;
			labels?: { sectionSubtitle?: string; sectionTitle?: string };
		};
		expect(family.presentation).toBe('text-only');
		expect(family.labels?.sectionSubtitle).toBe('Familia');
		expect(family.groups).toHaveLength(2);
		expect(family.groups?.[0]).toMatchObject({
			title: 'De la Novia',
			items: [
				{ name: 'Laura Carrillo Morales', role: 'Madre' },
				{ name: 'Pilar Medina Martínez', role: 'Padre' },
			],
		});
		expect(family.groups?.[1]).toMatchObject({
			title: 'Del Novio',
			items: [{ name: 'María de Jesús Felipe Redondo', role: 'Madre' }],
		});

		const gallery = content.gallery as {
			items: unknown[];
			subtitle?: string;
			title?: string;
		};
		expect(gallery.items).toHaveLength(1);
		expect(gallery.subtitle).toBeUndefined();

		const rsvp = content.rsvp as {
			confirmationMode?: string;
			accessMode?: string;
			personalizedAccess?: { noteText?: string };
		};
		expect(rsvp.confirmationMode).toBe('api');
		expect(rsvp.accessMode).toBe('hybrid');
		expect(rsvp.personalizedAccess?.noteText).toContain('{count}');
		expect((content.sectionStyles as { rsvp?: unknown } | undefined)?.rsvp).toEqual({
			structuralVariant: 'standard',
		});

		const thankYou = content.thankYou as {
			image?: unknown;
			closingName?: string;
			date?: string;
		};
		expect(thankYou.image).toBeUndefined();
		expect(thankYou.closingName).toBe('Daniela & Martín');
		expect(thankYou.date).toBe('28 de noviembre de 2026');

		const serialized = JSON.stringify(content);
		expect(serialized).not.toMatch(/\[\[PENDIENTE:/);
		expect(serialized).not.toMatch(/Por confirmar/);
		expect(serialized).not.toMatch(
			/boda-daniela-y-martin|perla_medina|Perla & Carlos|Perla y Carlos/,
		);
		expect(serialized).not.toMatch(/hero-mobile-source/);
	});

	it('enforces the two-action map contract end-to-end', () => {
		// Payload declares the opt-out explicitly so the live row stays
		// in lockstep with the canonical source.
		const published = buildDanielaPublishedContent(buildTestAssets());
		expect(
			(
				published.location as
					{ presentationOptions?: { showNavigationButtons?: boolean } } | undefined
			)?.presentationOptions?.showNavigationButtons,
		).toBe(false);

		// The adapter must surface the opt-out on the section data the
		// render plan and EventLocation consume.
		const viewModel = adaptEvent({
			id: 'events/daniela-y-martin',
			data: published,
		} as unknown as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.sections.location?.showNavigationButtons).toBe(false);
	});

	it('keeps provider navigation enabled for the existing wedding control invitation', () => {
		expect(resolveLocationShowNavigationButtons(undefined)).toBe(true);

		const viewModel = adaptEvent({
			id: 'event-demos/boda/demo-boda-jewelry-box-wedding.json',
			data: demoBodaJewelryBoxWedding,
		} as unknown as Parameters<typeof adaptEvent>[0]);

		expect(viewModel.sections.location?.showNavigationButtons).toBe(true);
	});
});
