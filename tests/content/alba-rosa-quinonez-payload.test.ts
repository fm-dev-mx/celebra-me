import { resolveInvitationTheme } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptEvent } from '@/lib/adapters/event';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import fs from 'node:fs';
import path from 'node:path';
import {
	ALBA_ASSET_SPECS,
	ALBA_EVENT,
	buildAlbaPublishedContent,
} from '../../scripts/provision/invitations/alba-rosa-quinonez.ts';
import { buildTestAssets } from '../helpers/managed-payload';
import { invitationMediaPaths } from '../helpers/invitation-media';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

const albaProfilePath = path.join(
	process.cwd(),
	'src/styles/invitation-profiles/alba-rosa-quinonez.scss',
);

const albaAssetDir = invitationMediaPaths(getInvitationDefinition('alba-rosa-quinonez'));

function publishedContent() {
	return buildAlbaPublishedContent(buildTestAssets(ALBA_ASSET_SPECS));
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
	it('uses a consistent luxury-hacienda theme', () => {
		expect(resolveInvitationTheme({ themeId: ALBA_EVENT.themeId })).toBe(ALBA_EVENT.themeId);
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
			expect(albaAssetDir.has(spec.relativePath)).toBe(true);
			expect(path.extname(spec.relativePath)).toBe('.webp');
		}
		expect(albaAssetDir.has('gallery-04-cafe.webp')).toBe(false);
	});

	it('builds published content with structural contracts', () => {
		const content = publishedContent();
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
		expect(content.sectionStyles).toBeUndefined();
		expect(asRecord(content.thankYou).variant).toBe('standard');

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
		const reception = asRecord(
			(location.venues as Array<Record<string, unknown>> | undefined)?.find(
				(venue) => venue.type === 'reception',
			),
		);
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
		const content = publishedContent();
		const viewModel = adaptEvent({
			slug: ALBA_EVENT.slug,
			content,
			assetSlug: ALBA_EVENT.assetSlug,
		});
		const page = buildPageContextFromViewModel({
			viewModel,
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

	it('rejects a DB payload when a required gallery variant is omitted', () => {
		const rawContent = publishedContent();
		// Simulate un-migrated Production DB state where gallery.variant is omitted
		const galleryWithoutVariant = { ...(rawContent.gallery as Record<string, unknown>) };
		delete galleryWithoutVariant.variant;
		const content = {
			...rawContent,
			gallery: galleryWithoutVariant,
		};

		expect(eventContentSchema.safeParse(content).success).toBe(false);
	});
});
