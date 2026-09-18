import { findDemoPreset } from '@/lib/intake/demo-preset-catalog';
import { checkPublishGuard } from '@/lib/intake/services/invitation-preset-resolver';
import { adaptEvent } from '@/lib/adapters/event';
import { buildInvitationRenderPlan } from '@/lib/invitation/render-plan';
import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';
import { deriveStartsAtUtc } from '@/lib/time/event-time';
import fs from 'node:fs';
import path from 'node:path';
import {
	MELISSA_ASSET_SPECS,
	MELISSA_EVENT,
	buildMelissaPublishedContent,
	type MelissaAssetMap,
} from '../../scripts/provision/invitations/melissa-y-luis-osmar.ts';
import { getInvitationDefinition } from '../../scripts/provision/invitations/registry.ts';

const profilePath = path.join(
	process.cwd(),
	'src/styles/invitation-profiles/melissa-y-luis-osmar.scss',
);
const assetDir = path.join(process.cwd(), 'src/assets/invitations/melissa-y-luis-osmar');

function buildTestAssets(): MelissaAssetMap {
	return Object.fromEntries(
		MELISSA_ASSET_SPECS.map((spec, index) => [
			spec.key,
			{
				type: 'uploaded' as const,
				assetId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
				src: `http://127.0.0.1:54321/storage/v1/object/public/invitation-assets/${spec.relativePath}`,
			},
		]),
	) as MelissaAssetMap;
}

describe('Boda Melissa y Luis Osmar provision contract', () => {
	it('registers an in-progress managed jewelry-box definition', () => {
		const definition = getInvitationDefinition('melissa-y-luis-osmar');
		expect(definition).toMatchObject({
			slug: 'melissa-y-luis-osmar',
			eventType: 'boda',
			hostLoginAlias: 'melissa_landell',
			baseDemoId: 'demo-boda-jewelry-box-wedding',
			themeId: 'jewelry-box-wedding',
			visualProfileId: 'melissa-y-luis-osmar',
			lifecycle: 'in_progress',
			managedIdentityProvenance: 'owner-approved',
			deliveryScope: 'content-and-assets',
		});
		expect(definition.clientName).toBe('Melissa Landell Osuna');
		expect(definition.title).toContain('Luis Osmar Muñoz Rodríguez');

		expect(findDemoPreset(MELISSA_EVENT.baseDemoId)).toMatchObject({
			id: 'demo-boda-jewelry-box-wedding',
			eventType: 'boda',
			themeId: 'jewelry-box-wedding',
		});
		expect(
			checkPublishGuard({
				baseDemoId: MELISSA_EVENT.baseDemoId,
				themeId: MELISSA_EVENT.themeId,
			}),
		).toEqual({ ok: true });
	});

	it('keeps the Mazatlan wall clock and canonical UTC instant aligned', () => {
		expect(MELISSA_EVENT.timeZone).toBe('America/Mazatlan');
		expect(deriveStartsAtUtc(MELISSA_EVENT.localDateTime, MELISSA_EVENT.timeZone)).toBe(
			MELISSA_EVENT.startsAtUtc,
		);
	});

	it('ships two optimized editorial assets and preserves both masters', () => {
		expect(MELISSA_ASSET_SPECS.map((asset) => asset.key)).toEqual([
			'cathedral-editorial',
			'belcanto-editorial',
		]);
		for (const asset of MELISSA_ASSET_SPECS) {
			const derivative = path.join(assetDir, asset.relativePath);
			expect(fs.existsSync(derivative)).toBe(true);
			expect(fs.statSync(derivative).size).toBeLessThanOrEqual(300_000);
			expect(asset.optimizationRole).toBe('editorial-featured');
		}
		for (const sourceName of ['cathedral-editorial.png', 'belcanto-editorial.png']) {
			expect(fs.existsSync(path.join(assetDir, 'source', sourceName))).toBe(true);
		}
	});

	it('keeps the visual profile scoped, restrained, and variant-independent', () => {
		const profile = fs.readFileSync(profilePath, 'utf8');
		expect(profile).toContain('.event--melissa-y-luis-osmar.theme-preset--jewelry-box-wedding');
		expect(profile).toContain('--melissa-paper: rgb(247 243 237)');
		expect(profile).toContain('--melissa-champagne: rgb(169 130 90)');
		expect(profile).toContain("data-intersection='overlap'");
		expect(profile).toContain("data-intersection='arch'");
		expect(profile).toContain('@media (prefers-reduced-motion: reduce)');
		expect(profile).not.toMatch(/data-variant=['"](?:formal-pass|formal-register)/);
		expect(profile).not.toMatch(/OneDrive|Clientes\\/i);
	});

	it('builds the exact editorial narrative with canonical variants', () => {
		const content = buildMelissaPublishedContent(buildTestAssets());
		const result = eventContentSchema.safeParse(content);
		expect(result.success).toBe(true);

		expect(content.sectionOrder).toEqual([
			'quote',
			'countdown',
			'family',
			'location',
			'itinerary',
			'gifts',
			'personalizedAccess',
			'rsvp',
			'thankYou',
		]);
		expect(content).not.toHaveProperty('gallery');
		expect(content).not.toHaveProperty('music');

		expect(content.hero).toMatchObject({
			name: 'Melissa',
			secondaryName: 'Luis Osmar',
			variant: 'ceremonial-portrait',
			presentation: { portraitEnabled: false },
		});
		expect(content.countdown).toMatchObject({ variant: 'clock-face' });
		expect(content.family).toMatchObject({
			variant: 'asymmetric-groups',
			presentation: 'text-only',
		});
		expect(content.location).toMatchObject({
			variant: 'stacked-venue-plates',
			presentationOptions: { showNavigationButtons: false },
		});
		expect(content.itinerary).toMatchObject({ variant: 'editorial-ledger' });
		expect(content.rsvp).toMatchObject({
			variant: 'formal-register',
			accessMode: 'personalized-only',
			confirmationMode: 'api',
			personalizedAccess: { variant: 'formal-pass' },
		});
		expect(content.thankYou).toMatchObject({
			variant: 'ceremonial-closing',
			date: '16 de diciembre de 2026',
		});
	});

	it('preserves confirmed names, schedule, policy, gifts, and RSVP deadline', () => {
		const content = buildMelissaPublishedContent(buildTestAssets());
		const serialized = JSON.stringify(content);

		expect(serialized).toContain(
			'Dicen que cuando encuentras a la persona correcta, el corazón lo sabe.',
		);
		for (const name of [
			'Martha Elena Osuna Rubio',
			'Rodrigo Landell Osuna',
			'Martha Leticia Rodríguez Vargas',
			'Jesús Gerardo Muñoz Silva',
			'Leonardo Campuzano',
			'María Laura Moraga',
			'Lucina Elsi Morán',
			'Darío Osuna Rubio',
		]) {
			expect(serialized).toContain(name);
		}
		expect(serialized).toContain('Con la bendición de Dios y de nuestros padres');
		expect(serialized).toContain('Gala formal');
		expect(serialized).toContain('Celebración reservada para adultos');

		const itinerary = content.itinerary as { items: Array<{ time: string }> };
		expect(itinerary.items.map((item) => item.time)).toEqual(['12:00', '14:00', '15:00']);

		const gifts = content.gifts as {
			items: Array<{ type: string; tableNumber?: string; url?: string }>;
		};
		expect(gifts.items).toContainEqual(
			expect.objectContaining({
				type: 'store',
				tableNumber: '60019030',
				url: 'https://mesaderegalos.liverpool.com.mx/eventodebusqueda',
			}),
		);
		expect(gifts.items).toContainEqual(expect.objectContaining({ type: 'cash' }));
		expect(serialized).not.toMatch(/paypal|mercado\s*pago|transferencia bancaria/i);

		const rsvp = content.rsvp as { subcopy: string; personalizedAccess: { noteText: string } };
		expect(rsvp.subcopy).toContain('16 de noviembre de 2026');
		expect(rsvp.personalizedAccess.noteText).toContain('{count}');
		expect(rsvp.personalizedAccess.noteText).toContain('pase asignado');
	});

	it('places both architectural interludes in the intended render order', () => {
		const content = buildMelissaPublishedContent(buildTestAssets());
		const interludes = content.interludes as Array<{
			afterSection: string;
			focalPoint?: string;
		}>;
		expect(interludes.map((item) => item.afterSection)).toEqual(['family', 'itinerary']);
		expect(interludes.every((item) => item.focalPoint === undefined)).toBe(true);

		const viewModel = adaptEvent({
			id: 'events/melissa-y-luis-osmar',
			data: content,
		} as Parameters<typeof adaptEvent>[0]);
		expect(viewModel.sections.rsvp?.variant).toBe('formal-register');
		expect(viewModel.sections.rsvp?.personalizedAccess?.variant).toBe('formal-pass');

		const renderPlan = buildInvitationRenderPlan(viewModel);
		expect(
			renderPlan.map((item) => (item.type === 'section' ? item.section : item.type)),
		).toEqual([
			'quote',
			'countdown',
			'family',
			'interlude',
			'location',
			'itinerary',
			'interlude',
			'gifts',
			'personalized-access',
			'rsvp',
			'thankYou',
		]);
		expect(
			renderPlan.filter((item) => item.type === 'interlude').map((item) => item.intersection),
		).toEqual([
			{ family: 'overlap', source: 'family' },
			{ family: 'neutral', source: 'interlude-after-itinerary' },
		]);
		expect(
			renderPlan.find((item) => item.type === 'section' && item.section === 'family')
				?.intersection,
		).toEqual({
			family: 'atmospheric-blend',
			source: 'countdown',
		});
		expect(
			renderPlan.find((item) => item.type === 'personalized-access')?.intersection,
		).toEqual({
			family: 'arch',
			source: 'gifts',
		});
		expect(
			renderPlan.find((item) => item.type === 'section' && item.section === 'thankYou')
				?.intersection,
		).toEqual({
			family: 'atmospheric-blend',
			source: 'rsvp',
		});

		expect(JSON.stringify(content)).not.toMatch(/OneDrive|Clientes\\/i);
	});
});
