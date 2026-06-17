import fs from 'node:fs';
import path from 'node:path';

import { adaptEvent } from '@/lib/adapters/event';

function loadFixture(relativePath: string) {
	const filePath = path.resolve(process.cwd(), relativePath);
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function makeMinimalEvent(location: Record<string, unknown>) {
	return {
		id: 'events/test',
		data: {
			eventType: 'xv',
			title: 'Test Event',
			hero: {
				name: 'Test',
				date: '2027-11-20',
				backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
			},
			theme: { preset: 'enchanted-rose' },
			location,
		},
	} as Parameters<typeof adaptEvent>[0];
}

describe('adaptEvent', () => {
	it('all events default to branding visible when called via adaptEvent (no guest context)', () => {
		const demos = [
			'event-demos/xv/demo-xv-jewelry-box',
			'event-demos/xv/demo-xv-enchanted-rose',
		];

		for (const demoPath of demos) {
			const event = {
				id: demoPath,
				data: loadFixture(`src/content/${demoPath}.json`),
			} as Parameters<typeof adaptEvent>[0];

			expect(adaptEvent(event).brandingVisibility).toEqual({
				showFooterBranding: true,
				showContactCta: true,
				showThankYouBranding: true,
			});
		}
	});

	it('preserves family godparents in the invitation view model', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.family?.godparents).toEqual([
			{ name: 'Sr. Juan Carlos', role: 'Padrino de Honor' },
			{ name: 'Sra. Ana María', role: 'Madrina de Honor' },
		]);
	});

	it('keeps godparents undefined when the event omits them', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				family: {
					...fixture.family,
					godparents: undefined,
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.family?.godparents).toBeUndefined();
	});

	it('resolves demo content blocks and venue data', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.theme.preset).toBe('jewelry-box');
		expect(viewModel.sections.location?.ceremony).toBeDefined();
		expect(viewModel.sections.location?.ceremony?.venueName).toBeTruthy();
		expect(viewModel.sections.location?.variant).toBe('jewelry-box');
		expect(viewModel.hero.backgroundImage.src).toBe('test-file-stub');
	});

	it('passes location intro copy through to the invitation view model', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				location: {
					...fixture.location,
					introEyebrow: 'EL CAMINO AL PALACIO',
					introHeading: 'Ubicación',
					introLede: 'Guarda la ruta y llega con calma.',
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.location).toMatchObject({
			introEyebrow: 'EL CAMINO AL PALACIO',
			introHeading: 'Ubicación',
			introLede: 'Guarda la ruta y llega con calma.',
		});
	});

	it('supports normalized object asset references from the schema layer', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				hero: {
					...fixture.hero,
					backgroundImage: {
						type: 'internal',
						key: 'hero',
					},
					portrait: {
						type: 'external',
						src: '/images/custom-portrait.webp',
					},
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.hero.backgroundImage.src).toBe('test-file-stub');
		expect(viewModel.hero.portrait?.src).toBe('/images/custom-portrait.webp');
	});

	it('uses content _assetSlug for static demos whose route slug differs from asset slug', () => {
		const event = {
			id: 'event-demos/baby-shower/demo-baby-shower-celestial',
			data: {
				eventType: 'baby-shower',
				isDemo: true,
				title: 'Baby Shower de Luna Celeste',
				_assetSlug: 'demo-baby-shower-celestial',
				theme: { preset: 'celestial-blue' },
				hero: {
					name: 'Luna Celeste',
					date: '2026-08-15T22:00:00.000Z',
					backgroundImage: 'hero',
				},
				location: {
					venues: [
						{
							type: 'custom',
							venueName: 'Jardín Las Nubes',
							address: 'Av. Cielo Pastel 123',
							date: 'sábado, 15 de agosto de 2026',
							time: '4:00 PM',
							venueEvent: 'Baby Shower',
						},
					],
				},
				rsvp: {
					title: 'Confirma tu asistencia',
					guestCap: 4,
					accessMode: 'hybrid',
					confirmationMessage: 'Gracias por confirmar',
					confirmationMode: 'api',
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.id).toBe('demo-baby-shower-celestial');
		expect(viewModel.sections.rsvp?.eventSlug).toBe('demo-baby-shower-celestial');
		expect(viewModel.hero.backgroundImage.src).toBe('test-file-stub');
	});

	it('resolves backgroundImageMobile when present in hero data', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				hero: {
					...fixture.hero,
					backgroundImageMobile: {
						type: 'external',
						src: '/images/mobile-bg.webp',
					},
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.hero.backgroundImageMobile).toBeDefined();
		expect(viewModel.hero.backgroundImageMobile?.src).toBe('/images/mobile-bg.webp');
	});

	it('preserves thank-you overlay composition metadata', () => {
		const fixture = loadFixture(
			'src/content/event-demos/bautismo/demo-bautismo-angelic-presence.json',
		);
		const event = {
			id: 'event-demos/bautismo/demo-bautismo-angelic-presence',
			data: {
				...fixture,
				thankYou: {
					...fixture.thankYou,
					overlayAnchor: 'left',
					overlaySafeArea: {
						x: 0.5,
						y: 0.08,
						width: 0.34,
						height: 0.42,
					},
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.thankYou).toMatchObject({
			overlayAnchor: 'left',
			overlaySafeArea: {
				x: 0.5,
				y: 0.08,
				width: 0.34,
				height: 0.42,
			},
		});
	});

	it('preserves explicit interlude variants for editorial content blocks', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-editorial',
			data: loadFixture('src/content/event-demos/xv/demo-xv-editorial.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.theme.preset).toBe('editorial');
		expect(viewModel.interludes?.find((i) => i.variant === 'editorial')).toMatchObject({
			variant: 'editorial',
		});
	});

	it('countdown prefers eventTiming.startsAtUtc over hero date', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
				eventTiming: {
					localDateTime: '2026-04-25T18:00',
					timeZone: 'America/Mazatlan',
					startsAtUtc: '2026-04-26T01:00:00.000Z',
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.countdown).toBeDefined();
		expect(viewModel.sections.countdown?.targetIso).toBe('2026-04-26T01:00:00.000Z');
		expect(viewModel.sections.countdown?.targetSource).toBe('eventTiming');
	});

	it('countdown uses centralized legacy fallback when eventTiming is missing', () => {
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json'),
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.countdown).toBeDefined();
		expect(viewModel.sections.countdown?.targetIso).toBe(viewModel.hero.date);
		expect(viewModel.sections.countdown?.targetSource).toBe('legacyHeroDate');
	});

	it('countdown renders from eventTiming alone without explicit countdown content', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');

		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				countdown: undefined,
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.countdown).toBeDefined();
		expect(viewModel.sections.countdown?.targetIso).toBe(viewModel.hero.date);
		expect(viewModel.sections.countdown?.title).toBe('¡Falta muy poco!');
		expect(viewModel.sections.countdown?.footerText).toBeDefined();
	});

	it('countdown is undefined when neither countdown content nor resolvable target exists', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');

		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				countdown: undefined,
				eventTiming: undefined,
				hero: {
					...fixture.hero,
					date: '2026-06-21',
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.countdown).toBeUndefined();
	});

	it('injects countdown into sectionOrder when synthesized from eventTiming alone', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');

		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				countdown: undefined,
				sectionOrder: [
					'quote',
					'family',
					'location',
					'itinerary',
					'rsvp',
					'gifts',
					'thankYou',
				],
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.countdown).toBeDefined();
		expect(viewModel.sectionOrder).toBeDefined();
		expect(viewModel.sectionOrder!.indexOf('countdown')).toBeLessThan(
			viewModel.sectionOrder!.indexOf('location'),
		);
	});

	it('does not inject countdown into sectionOrder when no resolvable target exists', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');

		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				countdown: undefined,
				eventTiming: undefined,
				hero: {
					...fixture.hero,
					date: '2026-06-21',
				},
				sectionOrder: [
					'quote',
					'family',
					'location',
					'itinerary',
					'rsvp',
					'gifts',
					'thankYou',
				],
			},
		} as Parameters<typeof adaptEvent>[0];

		const viewModel = adaptEvent(event);

		expect(viewModel.sections.countdown).toBeUndefined();
		expect(viewModel.sectionOrder).toBeDefined();
		expect(viewModel.sectionOrder!.includes('countdown')).toBe(false);
	});

	it('throws for invalid theme presets instead of silently falling back', () => {
		const fixture = loadFixture('src/content/event-demos/xv/demo-xv-jewelry-box.json');
		const event = {
			id: 'event-demos/xv/demo-xv-jewelry-box',
			data: {
				...fixture,
				theme: {
					...fixture.theme,
					preset: 'broken-preset',
				},
			},
		} as Parameters<typeof adaptEvent>[0];

		expect(() => adaptEvent(event)).toThrow(
			'[ThemePreset] Invalid preset "broken-preset". Expected one of:',
		);
	});

	describe('location theme defaults', () => {
		it('applies enchanted-rose defaults when location intro fields are missing', () => {
			const event = {
				id: 'event-demos/xv/demo-xv-enchanted-rose',
				data: loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json'),
			} as Parameters<typeof adaptEvent>[0];

			const viewModel = adaptEvent(event);

			expect(viewModel.sections.location?.introEyebrow).toBe('EL CAMINO AL PALACIO');
			expect(viewModel.sections.location?.introHeading).toBe('Ubicación');
			expect(viewModel.sections.location?.introLede).toBe(
				'Guarda la ruta y llega con calma a una noche entre rosas, música y luz de velas.',
			);
			expect(viewModel.sections.location?.indicationsHeading).toBe('Detalles adicionales');
		});

		it('does not override explicit intro fields with theme defaults', () => {
			const event = {
				id: 'event-demos/xv/demo-xv-enchanted-rose',
				data: {
					...loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json'),
					location: {
						introEyebrow: 'Custom Eyebrow',
						introHeading: 'Custom Heading',
						introLede: 'Custom Lede',
						indicationsHeading: 'Custom Indications',
						ceremony: {
							venueName: 'Test',
							address: 'Test',
							date: '2027-01-01',
							time: '6:00 PM',
						},
					},
				},
			} as Parameters<typeof adaptEvent>[0];

			const viewModel = adaptEvent(event);

			expect(viewModel.sections.location?.introEyebrow).toBe('Custom Eyebrow');
			expect(viewModel.sections.location?.introHeading).toBe('Custom Heading');
			expect(viewModel.sections.location?.introLede).toBe('Custom Lede');
			expect(viewModel.sections.location?.indicationsHeading).toBe('Custom Indications');
		});

		it('uses theme default indicationsHeading only when undefined, not when empty string', () => {
			const event = {
				id: 'event-demos/xv/demo-xv-enchanted-rose',
				data: {
					...loadFixture('src/content/event-demos/xv/demo-xv-enchanted-rose.json'),
					location: {
						introEyebrow: 'Eyebrow',
						introHeading: 'Heading',
						introLede: 'Lede',
						indicationsHeading: '',
						ceremony: {
							venueName: 'Test',
							address: 'Test',
							date: '2027-01-01',
							time: '6:00 PM',
						},
					},
				},
			} as Parameters<typeof adaptEvent>[0];

			const viewModel = adaptEvent(event);

			expect(viewModel.sections.location?.indicationsHeading).toBe('');
		});

		it('maps dressCode and additionalIndications into location.indications array via published content', () => {
			const event = {
				id: 'events/test',
				data: {
					eventType: 'xv',
					title: 'XV Años',
					hero: {
						name: 'Test',
						date: '2027-11-20',
						backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
					},
					theme: { preset: 'enchanted-rose' },
					location: {
						ceremony: {
							venueName: 'Test',
							address: 'Test',
							date: '2027-01-01',
							time: '6:00 PM',
						},
						indications: [
							{
								iconName: 'DressCode',
								styleVariant: 'reserved',
								text: 'Formal de gala',
							},
							{
								iconName: 'Calendar',
								styleVariant: 'default',
								text: 'Confirma antes del 6 de noviembre.',
							},
						],
					},
				},
			} as Parameters<typeof adaptEvent>[0];

			const viewModel = adaptEvent(event);

			const indications = viewModel.sections.location?.indications ?? [];
			expect(indications).toContainEqual(
				expect.objectContaining({
					iconName: 'DressCode',
					styleVariant: 'reserved',
					text: 'Formal de gala',
				}),
			);
			expect(indications).toContainEqual(
				expect.objectContaining({
					iconName: 'Calendar',
					styleVariant: 'default',
					text: 'Confirma antes del 6 de noviembre.',
				}),
			);
		});

		it('passes location.venues through to the view model when present', () => {
			const vm = adaptEvent(
				makeMinimalEvent({
					introHeading: 'Ubicaciones',
					venues: [
						{
							id: 'v1',
							type: 'reception',
							label: 'Recepción',
							venueName: 'Salón Principal',
							address: 'Calle 1',
							city: 'Querétaro',
							date: '2027-11-20',
							time: '20:00',
							mapUrl: 'https://maps.example.com',
							googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Salon',
							appleMapsUrl: 'https://maps.apple.com/?q=Salon',
							wazeUrl: 'https://waze.com/ul?q=Salon',
							venueEvent: 'Recepción',
							isVisible: true,
						},
						{
							id: 'v2',
							type: 'custom',
							label: 'Cena',
							venueName: 'Jardín Secreto',
							address: 'Calle 2',
							city: 'Querétaro',
							date: '2027-11-20',
							time: '22:00',
							venueEvent: 'Cena',
							isVisible: true,
						},
					],
				}),
			);
			const loc = vm.sections.location!;

			expect(loc.venues).toBeDefined();
			expect(loc.venues).toHaveLength(2);
			expect(loc.venues![0]!.venueName).toBe('Salón Principal');
			expect(loc.venues![0]!.type).toBe('reception');
			expect(loc.venues![0]!.label).toBe('Recepción');
			expect(loc.venues![0]!.id).toBe('v1');
			expect(loc.venues![0]!.mapUrl).toBe('https://maps.example.com');
			expect(loc.venues![0]!.googleMapsUrl).toBe(
				'https://www.google.com/maps/search/?api=1&query=Salon',
			);
			expect(loc.venues![0]!.appleMapsUrl).toBe('https://maps.apple.com/?q=Salon');
			expect(loc.venues![0]!.wazeUrl).toBe('https://waze.com/ul?q=Salon');
			expect(loc.venues![1]!.venueName).toBe('Jardín Secreto');
			expect(loc.venues![1]!.type).toBe('custom');
		});

		it('resolves venue images through asset registry for venues array', () => {
			const viewModel = adaptEvent(
				makeMinimalEvent({
					introHeading: 'Ubicaciones',
					venues: [
						{
							id: 'v1',
							type: 'reception',
							label: 'Recepción',
							venueName: 'Salón',
							address: 'Calle 1',
							date: '2027-11-20',
							time: '20:00',
							image: { type: 'external', src: '/images/venue.jpg' },
							venueEvent: 'Recepción',
							isVisible: true,
						},
					],
				}),
			);

			expect(viewModel.sections.location?.venues?.[0]?.image).toBeDefined();
			expect(viewModel.sections.location?.venues?.[0]?.image?.src).toBe('/images/venue.jpg');
		});

		it('does not filter venues by isVisible in adapter (filtering happens in publish mapper)', () => {
			const viewModel = adaptEvent(
				makeMinimalEvent({
					introHeading: 'Ubicaciones',
					venues: [
						{
							id: 'v1',
							type: 'ceremony',
							label: 'Ceremonia',
							venueName: 'Iglesia',
							address: 'Calle 1',
							date: '2027-11-20',
							time: '18:00',
							venueEvent: 'Ceremonia',
							isVisible: false,
						},
						{
							id: 'v2',
							type: 'reception',
							label: 'Recepción',
							venueName: 'Salón',
							address: 'Calle 2',
							date: '2027-11-20',
							time: '20:00',
							venueEvent: 'Recepción',
							isVisible: undefined,
						},
					],
				}),
			);

			expect(viewModel.sections.location?.venues).toHaveLength(2);
			expect(viewModel.sections.location?.venues?.[0]?.isVisible).toBe(false);
			expect(viewModel.sections.location?.venues?.[1]?.isVisible).toBeUndefined();
		});

		it('empty venues array stays empty and does not fall back to legacy ceremony/reception', () => {
			const viewModel = adaptEvent(
				makeMinimalEvent({
					introHeading: 'Ubicaciones',
					venues: [],
					ceremony: {
						venueName: 'Iglesia Legacy',
						address: 'Calle L',
						date: '2027-11-20',
						time: '18:00',
					},
					reception: {
						venueName: 'Salón Legacy',
						address: 'Calle R',
						date: '2027-11-20',
						time: '20:00',
					},
				}),
			);

			expect(viewModel.sections.location?.venues).toEqual([]);
			expect(viewModel.sections.location?.ceremony).toBeUndefined();
			expect(viewModel.sections.location?.reception).toBeUndefined();
		});

		it('absent venues allows legacy ceremony/reception fallback', () => {
			const viewModel = adaptEvent(
				makeMinimalEvent({
					introHeading: 'Ubicación',
					ceremony: {
						venueName: 'Iglesia Legacy',
						address: 'Calle L',
						city: 'Querétaro',
						date: '2027-11-20',
						time: '18:00',
					},
					reception: {
						venueName: 'Salón Legacy',
						address: 'Calle R',
						city: 'Querétaro',
						date: '2027-11-20',
						time: '20:00',
					},
				}),
			);

			expect(viewModel.sections.location?.venues).toBeUndefined();
			expect(viewModel.sections.location?.ceremony).toBeDefined();
			expect(viewModel.sections.location?.ceremony?.venueName).toBe('Iglesia Legacy');
			expect(viewModel.sections.location?.reception).toBeDefined();
			expect(viewModel.sections.location?.reception?.venueName).toBe('Salón Legacy');
		});

		it('backward-compatibility: published snapshot without intro fields uses theme defaults', () => {
			const event = {
				id: 'events/ayrin-samantha-lerma-castro',
				data: {
					eventType: 'xv',
					title: 'XV Años',
					hero: {
						name: 'Test',
						date: '2027-11-20',
						backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
					},
					theme: { preset: 'enchanted-rose' },
					location: {
						ceremony: {
							venueName: 'Parroquia del Sagrado Corazón',
							address: 'Av. de las Rosas 240',
							city: 'Querétaro',
							date: '20 de noviembre de 2027',
							time: '6:00 PM',
						},
						reception: {
							venueName: 'Salón Imperial',
							address: 'Paseo del Palacio 18',
							city: 'Querétaro',
							date: '20 de noviembre de 2027',
							time: '8:00 PM',
						},
					},
				},
			} as Parameters<typeof adaptEvent>[0];

			const viewModel = adaptEvent(event);

			expect(viewModel.sections.location?.introEyebrow).toBe('El camino al palacio');
			expect(viewModel.sections.location?.introHeading).toBe('Ubicación');
			expect(viewModel.sections.location?.introLede).toBe(
				'Guarda la ruta y llega con calma a una noche entre rosas, música y luz de velas.',
			);
			expect(viewModel.sections.location?.indicationsHeading).toBe('Detalles adicionales');
		});
	});
});
