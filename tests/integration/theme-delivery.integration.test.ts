import { prepareInvitationPageData } from '@/lib/invitation/page-data';
import type { EventContentEntry } from '@/lib/content/events';

describe('Theme Delivery Integration', () => {
	const mockEventBase: Partial<EventContentEntry> = {
		id: 'evt-123',
		slug: 'boda-demo',
		collection: 'events',
		data: {
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
		} as any,
	};

	it('should correctly inject CSS variable overrides from theme tokens', () => {
		const pageData = prepareInvitationPageData({
			eventEntry: mockEventBase as EventContentEntry,
			slug: 'boda-demo',
		});

		// Verify data attributes
		expect(pageData.wrapper.dataAttributes['data-theme-preset']).toBe('luxury-hacienda');
		expect(pageData.wrapper.dataAttributes['data-event-slug']).toBe('evt-123');

		// Verify scoped styles (CSS variable overrides)
		const styles = pageData.wrapper.scopedStyles;
		expect(styles).toContain('[data-event-slug="evt-123"]');

		// luxury-hacienda tokens from PRESET_COLOR_MAP
		expect(styles).toContain('--color-surface-primary-override: #F5F5DC;');
		expect(styles).toContain('--color-action-primary-override: #2C1E12;');
	});

	it('should include envelope color overrides when envelope is enabled', () => {
		const mockEventWithEnvelope = {
			...mockEventBase,
			data: {
				...mockEventBase.data,
				envelope: {
					enabled: true,
					closedPalette: {
						background: '#f0f0f0',
						primary: '#333333',
					},
					variant: 'jewelry-box',
				},
			},
		};

		const pageData = prepareInvitationPageData({
			eventEntry: mockEventWithEnvelope as EventContentEntry,
			slug: 'boda-demo',
		});

		const styles = pageData.wrapper.scopedStyles;
		expect(styles).toContain('--env-bg: #f0f0f0;');
		expect(styles).toContain('--env-primary: #333333;');
		expect(pageData.wrapper.dataAttributes['data-env-variant']).toBe('jewelry-box');
	});
});
