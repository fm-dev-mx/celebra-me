import { isDevEnvironment } from '@/lib/environment';
import { adaptEvent } from '@/lib/adapters/event';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import type { InvitationViewModel } from '@/lib/adapters/types';

const isDev = isDevEnvironment as jest.MockedFunction<typeof isDevEnvironment>;

const PLAYABLE_URL = 'https://res.cloudinary.com/example/video/upload/song.mp3';

const baseViewModel = {
	id: 'leslie-perez',
	isDemo: false,
	title: 'XV años de Leslie',
	description: 'Invitación de prueba',
	theme: { preset: 'celestial-blue' as const, themeClass: 'theme-preset--celestial-blue' },
	hero: {
		structuralVariant: 'split-cover' as const,
		name: 'Leslie',
		label: 'Mis XV años',
		date: '2026-09-26',
		backgroundImage: { src: '/img.jpg', alt: 'Leslie' },
		variant: 'split-cover' as const,
	},
	envelope: { enabled: true },
	brandingVisibility: {
		showFooterBranding: true,
		showContactCta: true,
	},
	sectionOrder: ['rsvp'],
	sections: {},
	interludes: [],
} as InvitationViewModel;

function makeMinimalEvent(music?: Record<string, unknown>) {
	return {
		id: 'events/leslie-perez',
		data: {
			eventType: 'xv',
			title: 'XV años de Leslie',
			hero: {
				name: 'Leslie',
				date: '2026-09-26',
				backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
			},
			theme: { preset: 'celestial-blue' },
			envelope: { enabled: true },
			...(music ? { music } : {}),
		},
	} as unknown as Parameters<typeof adaptEvent>[0];
}

function buildPage(viewModel: InvitationViewModel) {
	return buildPageContextFromViewModel({
		viewModel,
		slug: 'leslie-perez',
		eventType: 'xv',
	});
}

describe('invitation music player visibility', () => {
	const originalVercel = process.env.VERCEL;
	const originalVercelEnv = process.env.VERCEL_ENV;

	beforeEach(() => {
		isDev.mockReturnValue(false);
		delete process.env.VERCEL;
		delete process.env.VERCEL_ENV;
	});

	afterEach(() => {
		isDev.mockReturnValue(false);
		if (originalVercel === undefined) {
			delete process.env.VERCEL;
		} else {
			process.env.VERCEL = originalVercel;
		}
		if (originalVercelEnv === undefined) {
			delete process.env.VERCEL_ENV;
		} else {
			process.env.VERCEL_ENV = originalVercelEnv;
		}
	});

	describe('adaptEvent', () => {
		it('keeps playable music for the page resolver', () => {
			const viewModel = adaptEvent(
				makeMinimalEvent({
					url: `  ${PLAYABLE_URL}  `,
					autoPlay: true,
					title: 'Vals',
				}),
			);

			expect(viewModel.music).toEqual({
				url: PLAYABLE_URL,
				autoPlay: true,
				title: 'Vals',
				revealMode: 'envelope',
			});
		});

		it.each([
			['omitted music', undefined],
			['empty url', { url: '' }],
			['whitespace url', { url: '   ' }],
		])('drops %s so the view model has no music', (_label, music) => {
			const viewModel = adaptEvent(makeMinimalEvent(music));
			expect(viewModel.music).toBeUndefined();
		});
	});

	describe('page context happy paths', () => {
		it('exposes MusicPlayer props when published music has a playable URL', () => {
			const page = buildPage({
				...baseViewModel,
				music: {
					url: PLAYABLE_URL,
					autoPlay: true,
					title: 'Vals',
					revealMode: 'envelope',
				},
			});

			expect(page.musicPlayer).toEqual({
				url: PLAYABLE_URL,
				autoPlay: true,
				title: 'Vals',
				revealMode: 'envelope',
				variant: 'standard',
			});
		});

		it('uses immediate reveal when the envelope is disabled', () => {
			const page = buildPage({
				...baseViewModel,
				envelope: { enabled: false },
				music: {
					url: PLAYABLE_URL,
					autoPlay: false,
					revealMode: 'immediate',
				},
			});

			expect(page.musicPlayer).toMatchObject({
				url: PLAYABLE_URL,
				revealMode: 'immediate',
			});
		});
	});

	describe('page context sad paths', () => {
		it('does not render a player when the view model has no music', () => {
			expect(buildPage(baseViewModel).musicPlayer).toBeUndefined();
		});

		it('does not render a player for blank music URLs', () => {
			const page = buildPage({
				...baseViewModel,
				music: { url: '   ', autoPlay: false, revealMode: 'envelope' },
			});
			expect(page.musicPlayer).toBeUndefined();
		});

		it('does not leak the local empty-player placeholder on hosted Vercel when DEV is true', () => {
			isDev.mockReturnValue(true);
			process.env.VERCEL = '1';
			process.env.VERCEL_ENV = 'production';

			const fromOmittedMusic = buildPage(baseViewModel);
			const fromBlankMusic = buildPage({
				...baseViewModel,
				music: { url: '', autoPlay: false, title: 'Música de fondo', revealMode: 'envelope' },
			});

			expect(fromOmittedMusic.musicPlayer).toBeUndefined();
			expect(fromBlankMusic.musicPlayer).toBeUndefined();
		});

		it('does not leak the placeholder on hosted Preview', () => {
			isDev.mockReturnValue(true);
			process.env.VERCEL_ENV = 'preview';
			expect(buildPage(baseViewModel).musicPlayer).toBeUndefined();
		});
	});

	describe('published content without music', () => {
		it('keeps the player hidden through adaptEvent + page assembly on a hosted runtime', () => {
			isDev.mockReturnValue(true);
			process.env.VERCEL = '1';
			process.env.VERCEL_ENV = 'production';

			const viewModel = adaptEvent(makeMinimalEvent());
			const page = buildPage(viewModel);

			expect(viewModel.music).toBeUndefined();
			expect(page.musicPlayer).toBeUndefined();
		});
	});
});
