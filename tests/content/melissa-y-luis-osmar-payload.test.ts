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
	MELISSA_MUSIC,
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

describe('Boda Melissa y Luis Osmar managed content regression', () => {
	it('registers a published managed jewelry-box definition', () => {
		const definition = getInvitationDefinition('melissa-y-luis-osmar');
		expect(definition).toMatchObject({
			slug: 'melissa-y-luis-osmar',
			eventType: 'boda',
			hostLoginAlias: 'melissa_landell',
			baseDemoId: 'demo-boda-jewelry-box-wedding',
			themeId: 'jewelry-box-wedding',
			visualProfileId: 'melissa-y-luis-osmar',
			lifecycle: 'published',
			managedIdentityProvenance: 'persisted',
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

	it('keeps the visual profile scoped and formal geometry variant-owned', () => {
		const profile = fs.readFileSync(profilePath, 'utf8');
		expect(profile).toContain('.event--melissa-y-luis-osmar.theme-preset--jewelry-box-wedding');
		expect(profile).toContain('--melissa-paper: rgb(247 243 237)');
		expect(profile).toContain('--melissa-champagne: rgb(169 130 90)');
		expect(profile).toContain("data-intersection='overlap'");
		expect(profile).toContain("data-intersection='arch'");
		expect(profile).toContain('@media (prefers-reduced-motion: reduce)');
		expect(profile).not.toContain('hero-landscape');
		expect(profile).not.toContain('--melissa-landscape-height');
		expect(profile).toContain('color: var(--melissa-champagne)');
		const formalControls = profile.match(
			/\.personalized-access\[data-variant='formal-pass'\]\s*\{([^}]+)\}/,
		)?.[1];
		expect(formalControls).toBeDefined();
		// The profile configures tokens only; shared owners keep element geometry and type rules.
		expect(
			formalControls
				?.split(';')
				.map((entry) => entry.trim())
				.filter(Boolean)
				.every((entry) => /^--(?:pa-|formal-chapter-)[\w-]+\s*:/.test(entry)),
		).toBe(true);
		expect(profile).not.toMatch(/\.access-card(?:__[\w-]+)?\s*\{/);
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
		expect(content.music).toEqual(MELISSA_MUSIC);

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
			venues: [
				expect.objectContaining({
					type: 'ceremony',
					googleMapsUrl: 'https://maps.app.goo.gl/fDfSjGhYbnG8FmYz8',
				}),
				expect.objectContaining({
					type: 'reception',
					googleMapsUrl: 'https://maps.app.goo.gl/thY2JoawdYj1vkbx8',
				}),
			],
		});
		expect(content.itinerary).toMatchObject({ variant: 'editorial-ledger' });
		expect(content.itinerary.items).toEqual([
			expect.objectContaining({ label: 'Ceremonia religiosa', time: '12:00' }),
			expect.objectContaining({ label: 'Recepción / cóctel de bienvenida', time: '14:00' }),
			expect.objectContaining({ label: 'Ceremonia civil', time: '15:00' }),
			{ iconName: 'Party', label: 'Primer baile y brindis', time: '17:00' },
		]);
		expect(JSON.stringify(content.itinerary)).not.toMatch(/banquete/i);
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

		expect(content.quote).toEqual({
			text: 'Dicen que cuando encuentras a la persona correcta, el corazón lo sabe.\nNosotros lo supimos y por eso queremos celebrar nuestro amor rodeados de las personas más importantes de nuestras vidas.',
		});
		expect(content.rsvp.calendar.startsAt).toBe('2026-12-16T19:00:00.000Z');
		expect(content.location.venues[0].time).toBe('12:00');
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
		expect(content.family.groups[1].items[1]).toEqual({
			name: 'Jesús Gerardo Muñoz Silva',
			role: 'Padre',
			deceased: true,
		});
		expect(serialized).toContain('De etiqueta.');
		expect(serialized).not.toContain('Gala formal.');
		expect(serialized).toContain('Celebración reservada para adultos');

		expect(content.itinerary.items.map((item) => item.time)).toEqual([
			'12:00',
			'14:00',
			'15:00',
			'17:00',
		]);

		expect(content.gifts.items).toContainEqual(
			expect.objectContaining({
				type: 'store',
				tableNumber: '60019030',
				url: 'https://mesaderegalos.liverpool.com.mx/eventodebusqueda',
			}),
		);
		expect(content.gifts.items).toContainEqual(
			expect.objectContaining({
				type: 'cash',
				title: 'Sobres',
				text: 'Podrá entregarnos su obsequio en efectivo dentro de un sobre durante la recepción.',
				iconName: 'Enveloped',
			}),
		);
		expect(serialized).not.toContain('Lluvia de sobres');
		expect(serialized).not.toMatch(/paypal|mercado\s*pago|transferencia bancaria/i);

		expect(content.rsvp.subcopy).toContain('16 de noviembre de 2026');
		expect(content.rsvp.personalizedAccess.noteText).toContain('{count}');
		expect(content.rsvp.personalizedAccess.noteText).toContain('Su pase incluye a');
	});

	it('preserves the cathedral and joins itinerary directly to gifts', () => {
		const content = buildMelissaPublishedContent(buildTestAssets());
		expect(content.interludes.map((item) => item.afterSection)).toEqual(['family']);
		expect(content.interludes[0].image).toEqual(buildTestAssets()['cathedral-editorial']);
		expect(
			content.interludes.every(
				(item: { afterSection: string; focalPoint?: string }) =>
					item.focalPoint === undefined,
			),
		).toBe(true);

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
			'gifts',
			'personalized-access',
			'rsvp',
			'thankYou',
		]);
		expect(
			renderPlan.filter((item) => item.type === 'interlude').map((item) => item.intersection),
		).toEqual([{ family: 'overlap', source: 'family' }]);
		expect(
			renderPlan.find((item) => item.type === 'section' && item.section === 'family')
				?.intersection,
		).toEqual({
			family: 'neutral',
			source: 'family',
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

		expect(
			renderPlan.find((item) => item.type === 'section' && item.section === 'gifts')
				?.intersection,
		).toEqual({ family: 'neutral', source: 'itinerary' });
		expect(JSON.stringify(content)).not.toMatch(/OneDrive|Clientes\\/i);
	});
});
