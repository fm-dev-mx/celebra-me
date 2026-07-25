import { prepareInvitationPageContext } from '@/lib/invitation/page-data';
import type { EventContentEntry } from '@/lib/content/events';
import { buildEventContentData } from '../helpers/event-content-fixture';

function makeEventEntry(data: EventContentEntry['data'], id = 'evt-123'): EventContentEntry {
	return {
		id,
		collection: 'event-demos',
		data,
	};
}

describe('Theme Delivery Integration', () => {
	const baseData = buildEventContentData({
		title: 'Boda Demo',
		eventType: 'boda',
		isDemo: false,
		theme: {
			preset: 'luxury-hacienda',
		},
		hero: {
			name: 'Celebrant',
			date: '2025-01-01T00:00:00.000Z',
			backgroundImage: '/assets/hero.jpg',
		},
		location: {
			reception: {
				venueName: 'Hacienda Demo',
				address: 'Centro',
				city: 'CDMX',
				date: '1 ene 2025',
				time: '18:00',
			},
		},
		envelope: {
			disabled: false,
		},
	});

	it('should deliver preset identity without injecting preset color overrides', () => {
		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(baseData),
			slug: 'boda-demo',
		});

		expect(pageContext.wrapper.dataAttributes['data-theme-preset']).toBe('luxury-hacienda');
		expect(pageContext.wrapper.dataAttributes['data-event-slug']).toBe('evt-123');

		const styles = pageContext.wrapper.scopedStyles;
		expect(styles).not.toContain('--color-surface-primary-override:');
		expect(styles).not.toContain('--color-action-primary-override:');
	});

	it('should include envelope semantic color overrides when envelope is enabled', () => {
		const data = buildEventContentData({
			...baseData,
			envelope: {
				disabled: false,
				closedPalette: {
					background: 'surfaceDark',
					primary: 'surfacePrimary',
				},
			},
		});

		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(data),
			slug: 'boda-demo',
		});

		const styles = pageContext.wrapper.scopedStyles;
		expect(styles).toContain('--env-bg: var(--color-surface-dark);');
		expect(styles).toContain('--env-paper-bg: var(--color-surface-dark);');
		expect(styles).toContain('--env-text-primary: var(--color-surface-primary);');
		expect(pageContext.wrapper.dataAttributes['data-env-variant']).toBeUndefined();
	});

	it('should not inject envelope background overrides without an explicit closed palette background', () => {
		const data = buildEventContentData({
			...baseData,
			envelope: {
				disabled: false,
				sealStyle: 'wax',
				microcopy: 'Abrir',
				closedPalette: {
					primary: 'surfacePrimary',
				},
			},
		});

		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(data),
			slug: 'boda-demo',
		});

		const styles = pageContext.wrapper.scopedStyles;
		expect(styles).not.toContain('--env-bg:');
		expect(styles).not.toContain('--env-paper-bg:');
		expect(styles).toContain('--env-text-primary: var(--color-surface-primary);');
	});

	it('should allow previewTheme to override only the delivered preset for premiere-family invitations', () => {
		const data = buildEventContentData({
			...baseData,
			eventType: 'xv',
			title: 'Ximena',
			theme: {
				preset: 'premiere-floral',
			},
			hero: {
				name: 'Ximena',
				date: '2026-04-11T20:00:00.000Z',
				backgroundImage: '/assets/hero.jpg',
				variant: 'premiere-floral',
			},
			location: {
				reception: {
					venueName: 'Venue',
					address: 'Centro',
					city: 'Los Mochis',
					date: '11 abr 2026',
					time: '20:00',
				},
			},
			sectionStyles: {
				location: {
					variant: 'premiere-floral',
				},
				footer: {
					variant: 'premiere-floral',
				},
			},
			envelope: {
				disabled: false,
				sealStyle: 'wax',
				microcopy: 'Abrir',
				closedPalette: {
					accent: 'surfaceDark',
				},
			},
		});

		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(data, 'events/ximena-meza-trasvina'),
			slug: 'ximena-meza-trasvina',
			previewTheme: 'editorial',
		});

		expect(pageContext.wrapper.dataAttributes['data-theme-preset']).toBe('editorial');
		expect(pageContext.viewModel.theme.preset).toBe('editorial');
		expect(pageContext.viewModel.envelope.data?.variant).toBe('editorial');
		expect(pageContext.footerVariant).toBe('editorial');
		expect(pageContext.viewModel.sections.location?.variant).toBe('editorial');
	});

	it('should deliver angelic-presence preset with correct wrapper attributes', () => {
		const data = buildEventContentData({
			...baseData,
			eventType: 'bautizo',
			title: 'Bautismo Demo',
			theme: {
				preset: 'angelic-presence',
			},
			hero: {
				name: 'María',
				date: '2026-06-15T10:00:00.000Z',
				backgroundImage: '/assets/hero.jpg',
			},
			location: {
				ceremony: {
					venueName: 'Parroquia de San José',
					address: 'Centro',
					city: 'Ciudad de México',
					date: '15 jun 2026',
					time: '10:00',
				},
			},
		});

		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(data, 'events/demo-bautismo-angelic-presence'),
			slug: 'demo-bautismo-angelic-presence',
		});

		expect(pageContext.wrapper.dataAttributes['data-theme-preset']).toBe('angelic-presence');
	});

	it('should render exactly one theme-preset class for angelic-presence', () => {
		const data = buildEventContentData({
			...baseData,
			eventType: 'bautizo',
			title: 'Bautismo Demo',
			theme: {
				preset: 'angelic-presence',
			},
			hero: {
				name: 'María',
				date: '2026-06-15T10:00:00.000Z',
				backgroundImage: '/assets/hero.jpg',
			},
			location: {
				ceremony: {
					venueName: 'Parroquia de San José',
					address: 'Centro',
					city: 'Ciudad de México',
					date: '15 jun 2026',
					time: '10:00',
				},
			},
		});

		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(data, 'events/demo-bautismo-angelic-presence'),
			slug: 'demo-bautismo-angelic-presence',
		});

		const themePresetClasses = pageContext.wrapper.className
			.split(' ')
			.filter((c) => c.startsWith('theme-preset--'));
		expect(themePresetClasses).toHaveLength(1);
		expect(themePresetClasses[0]).toBe('theme-preset--angelic-presence');
		expect(pageContext.wrapper.className).not.toContain('theme-preset--celestial-blue');
	});

	it('should not affect celestial-blue invitation through existing test coverage', () => {
		const celestialBlueData = buildEventContentData({
			title: 'XV de Ana Sofía',
			eventType: 'xv',
			isDemo: false,
			theme: {
				preset: 'celestial-blue',
			},
			hero: {
				name: 'Ana Sofía Cota Guillen',
				date: '2026-05-23T07:00:00.000Z',
				backgroundImage: '/assets/hero.jpg',
			},
			location: {
				reception: {
					venueName: "Palapa Zavala's",
					address: 'Centro',
					city: 'Los Mochis',
					date: '23 may 2026',
					time: '00:00',
				},
			},
		});

		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(celestialBlueData, 'events/ana-sofia-cota-guillen'),
			slug: 'ana-sofia-cota-guillen',
		});

		expect(pageContext.wrapper.dataAttributes['data-theme-preset']).toBe('celestial-blue');
		expect(pageContext.wrapper.className).toContain('theme-preset--celestial-blue');
		expect(pageContext.wrapper.className).not.toContain('theme-preset--angelic-presence');
	});
});
