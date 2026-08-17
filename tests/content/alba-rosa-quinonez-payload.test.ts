import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import fs from 'node:fs';
import path from 'node:path';
import {
	ALBA_ASSET_SPECS,
	ALBA_EVENT,
	buildAlbaPublishedContent,
	type AlbaAssetMap,
} from '../../scripts/provision/invitations/alba-rosa-quinonez.ts';

const albaProfilePath = path.join(
	process.cwd(),
	'src/styles/invitation-profiles/alba-rosa-quinonez.scss',
);

const albaAssetDir = path.join(process.cwd(), 'src/assets/invitations/alba-rosa-quinonez');

function buildTestAssets(): AlbaAssetMap {
	return Object.fromEntries(
		ALBA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.key}.webp`,
			},
		]),
	) as AlbaAssetMap;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * Provision / structural contracts for Alba Rosa.
 *
 * Editable invitation wording (titles, legends, venue labels, RSVP microcopy, etc.)
 * is intentionally not golden-asserted here: hosts may revise copy in the editor.
 * Exact Spanish fidelity belongs only in an explicitly named content-golden suite.
 */
describe('Alba Rosa Quiñónez provision contract', () => {
	it('uses a consistent luxury-hacienda catalog entry', () => {
		const preset = findDemoPreset(ALBA_EVENT.baseDemoId);
		expect(preset).toMatchObject({
			id: 'demo-cumple-luxury-hacienda',
			eventType: 'cumple',
			themeId: 'luxury-hacienda',
		});
		expect(
			checkPublishGuard({
				baseDemoId: ALBA_EVENT.baseDemoId,
				themeId: ALBA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('ships a Lane A profile scoped to the invitation event class', () => {
		const profile = fs.readFileSync(albaProfilePath, 'utf8');
		expect(profile).toContain('.event--alba-rosa-quinonez.theme-preset--luxury-hacienda');
		expect(profile).toContain('--alba-ivory');
		expect(profile).toContain('.invitation-hero__label-age');
		expect(profile).toContain('.invitation-hero__label-unit');
	});

	it('has WebP release sources for every declared asset', () => {
		for (const spec of ALBA_ASSET_SPECS) {
			const filePath = path.join(albaAssetDir, spec.relativePath);
			expect(fs.existsSync(filePath)).toBe(true);
			expect(path.extname(spec.relativePath)).toBe('.webp');
		}
		expect(fs.existsSync(path.join(albaAssetDir, 'gallery-04-cafe.webp'))).toBe(false);
	});

	it('builds schema-valid published content with structural contracts', () => {
		const content = buildAlbaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);

		const serialized = JSON.stringify(content);
		expect(serialized).not.toMatch(/\[\[PENDIENTE:/);

		expect(content.sectionOrder).toEqual([
			'countdown',
			'location',
			'gallery',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'family',
			'thankYou',
		]);
		expect(content.music).toBeUndefined();
		expect(content.itinerary).toBeUndefined();
		expect(content.sectionStyles).toMatchObject({
			thankYou: { variant: 'editorial-magazine' },
		});

		const hero = asRecord(content.hero);
		expect(hero).not.toHaveProperty('nickname');
		expect(hero.date).toBe(ALBA_EVENT.heroDate);
		expect(typeof hero.label).toBe('string');
		expect((hero.label as string).length).toBeGreaterThan(0);
		// Age-lockup format contract (digit + AÑOS) — wording unit stays structural
		expect(hero.label).toMatch(/^\d+\s+AÑOS$/iu);

		const envelope = asRecord(content.envelope);
		expect(envelope).toMatchObject({
			guestPlacement: 'outside-envelope',
		});
		expect(typeof envelope.cardLabel).toBe('string');
		expect(typeof envelope.envelopeName).toBe('string');
		expect(typeof envelope.cardName).toBe('string');
		expect(typeof envelope.sealInitials).toBe('string');

		const rsvp = asRecord(content.rsvp);
		expect(rsvp).toMatchObject({
			confirmationMode: 'api',
			accessMode: 'hybrid',
		});
		expect(typeof rsvp.title).toBe('string');

		const countdown = asRecord(content.countdown);
		expect(typeof countdown.title).toBe('string');
		expect((countdown.title as string).length).toBeGreaterThan(0);
		expect(countdown.presentationOptions).toEqual({ visibleUnits: ['days'] });

		const location = asRecord(content.location);
		expect(location.variant).toBe('split-map');
		expect(typeof location.introEyebrow).toBe('string');
		expect((location.introEyebrow as string).length).toBeGreaterThan(0);
		const reception = asRecord(location.reception);
		expect(typeof reception.venueName).toBe('string');
		expect(reception.coordinates).toEqual(
			expect.objectContaining({
				lat: expect.any(Number),
				lng: expect.any(Number),
				zoom: expect.any(Number),
			}),
		);

		const gifts = asRecord(content.gifts);
		expect(typeof gifts.subtitle).toBe('string');
		expect(gifts.presentation).toBe('legend-only');
		expect(gifts.items).toBeUndefined();

		const thankYou = asRecord(content.thankYou);
		expect(typeof thankYou.message).toBe('string');
		expect((thankYou.message as string).length).toBeGreaterThan(0);
		expect(typeof thankYou.closingName).toBe('string');
		expect(thankYou.date).toBe('12 de septiembre de 2026');

		const family = asRecord(content.family);
		expect(family.presentation).toBe('with-photo');
		const familyLabels = asRecord(family.labels);
		expect(typeof familyLabels.sectionMessage).toBe('string');

		const gallery = asRecord(content.gallery);
		const galleryItems = gallery.items as Array<Record<string, unknown>>;
		expect(galleryItems).toHaveLength(3);
		expect(galleryItems.map((item) => item.key)).toEqual(
			expect.arrayContaining(['gallery-02-london', 'gallery-05-albert']),
		);

		expect((content.interludes as unknown[]).length).toBe(1);
	});

	it('preserves Alba presentation and structural choices through page assembly', () => {
		const content = buildAlbaPublishedContent(buildTestAssets());
		const viewModel = adaptDbEvent({
			slug: ALBA_EVENT.slug,
			eventType: ALBA_EVENT.eventType,
			isDemo: false,
			content,
			assetSlug: ALBA_EVENT.assetSlug,
		});
		const page = buildPageContextFromViewModel({
			viewModel,
			slug: ALBA_EVENT.slug,
			eventType: ALBA_EVENT.eventType,
		});

		expect(viewModel.sections.countdown).toMatchObject({
			visibleUnits: ['days'],
		});
		expect(viewModel.sections.location).toMatchObject({
			variant: 'split-map',
		});
		expect(page.viewModel.sections.countdown?.visibleUnits).toEqual(['days']);
		expect(page.viewModel.sections.location?.variant).toBe('split-map');
		expect(
			page.renderPlan.map((item) => (item.type === 'section' ? item.section : item.type)),
		).toEqual(expect.arrayContaining(['countdown', 'location']));
	});
});
