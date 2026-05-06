import { prepareInvitationPageContext } from '@/lib/invitation/page-data';
import type { EventContentEntry } from '@/lib/content/events';

function makeEventEntry(data: EventContentEntry['data'], id = 'evt-123'): EventContentEntry {
	return {
		id,
		slug: data.slug,
		collection: 'events',
		data,
	} as EventContentEntry;
}

describe('Theme Delivery Integration', () => {
	const baseData = {
		title: 'Boda Demo',
		eventType: 'boda',
		status: 'published',
		slug: 'boda-demo',
		isDemo: false,
		theme: {
			preset: 'luxury-hacienda',
			primaryColor: 'accent',
		},
		hero: {
			name: 'Celebrant',
			date: '2025-01-01',
			backgroundImage: '/assets/hero.jpg',
		},
		location: {
			city: 'CDMX',
			venueName: 'Hacienda Demo',
		},
		sections: {
			rsvp: true,
		},
		envelope: {
			enabled: false,
		},
	} as EventContentEntry['data'];

	it('should correctly inject CSS variable overrides from theme tokens', () => {
		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(baseData),
			slug: 'boda-demo',
		});

		expect(pageContext.wrapper.dataAttributes['data-theme-preset']).toBe('luxury-hacienda');
		expect(pageContext.wrapper.dataAttributes['data-event-slug']).toBe('evt-123');

		const styles = pageContext.wrapper.scopedStyles;
		expect(styles).toContain('[data-event-slug="evt-123"]');

		expect(styles).toContain('--color-surface-primary-override: #F5F5DC;');
		expect(styles).toContain('--color-action-primary-override: #2C1E12;');
	});

	it('should include envelope color overrides when envelope is enabled', () => {
		const data = {
			...baseData,
			envelope: {
				enabled: true,
				closedPalette: {
					background: '#f0f0f0',
					primary: '#333333',
				},
			},
		} as EventContentEntry['data'];

		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(data),
			slug: 'boda-demo',
		});

		const styles = pageContext.wrapper.scopedStyles;
		expect(styles).toContain('--env-bg: #f0f0f0;');
		expect(styles).toContain('--env-paper-bg: #f0f0f0;');
		expect(styles).toContain('--env-text-primary: #333333;');
		expect(pageContext.wrapper.dataAttributes['data-env-variant']).toBeUndefined();
	});

	it('should not inject envelope background overrides without an explicit closed palette background', () => {
		const data = {
			...baseData,
			envelope: {
				disabled: false,
				sealStyle: 'wax',
				microcopy: 'Abrir',
				closedPalette: {
					primary: '#333333',
				},
			},
		} as EventContentEntry['data'];

		const pageContext = prepareInvitationPageContext({
			eventEntry: makeEventEntry(data),
			slug: 'boda-demo',
		});

		const styles = pageContext.wrapper.scopedStyles;
		expect(styles).not.toContain('--env-bg:');
		expect(styles).not.toContain('--env-paper-bg:');
		expect(styles).toContain('--env-text-primary: #333333;');
	});

	it('should allow previewTheme to override only the delivered preset for premiere-family invitations', () => {
		const data = {
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
				city: 'Los Mochis',
				venueName: 'Venue',
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
		} as EventContentEntry['data'];

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
});
