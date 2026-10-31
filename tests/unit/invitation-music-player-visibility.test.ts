import { adaptEvent } from '@/lib/adapters/event';
import { contentDocumentFromEntry, type EventContentEntry } from '@/lib/content/events';
import { buildPageContextFromViewModel } from '@/lib/invitation/page-data';
import type { InvitationViewModel } from '@/lib/adapters/types';
import { asHostedDeploy } from '@tests/helpers/deploy-identity';
import { musicSchema } from '@/lib/schemas/content/shared.schema';

const PLAYABLE_URL = 'https://cdn.example.com/example/video/upload/song.mp3';

const baseViewModel = {
	id: 'leslie-perez',
	isDemo: false,
	title: 'XV años de Leslie',
	description: 'Invitación de prueba',
	theme: { preset: 'celestial-blue' as const, themeClass: 'theme-preset--celestial-blue' },
	hero: {
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
	composition: { intersections: {} },
	sections: {},
	interludes: [],
} as InvitationViewModel;

function makeMinimalEvent(music?: Record<string, unknown>) {
	return {
		id: 'events/leslie-perez',
		data: {
			eventType: 'xv',
			title: 'XV años de Leslie',
			sectionOrder: ['rsvp'],
			composition: { intersections: {} },
			hero: {
				name: 'Leslie',
				date: '2026-09-26',
				backgroundImage: { type: 'external', src: '/images/test-bg.jpg' },
				variant: 'standard',
			},
			theme: { preset: 'celestial-blue' },
			envelope: { enabled: true },
			...(music ? { music } : {}),
		},
	} as unknown as EventContentEntry;
}

function buildPage(viewModel: InvitationViewModel) {
	return buildPageContextFromViewModel({
		viewModel,
		eventType: 'xv',
	});
}

describe('invitation music player visibility', () => {
	it('keeps same-site music credits through the adapter and page resolver', () => {
		const creditsUrl = '/music/example-credits.html';
		const music = musicSchema.parse({ url: PLAYABLE_URL, creditsUrl });
		const viewModel = adaptEvent(contentDocumentFromEntry(makeMinimalEvent(music)));
		expect(buildPage(viewModel).musicPlayer?.creditsUrl).toBe(creditsUrl);
		for (const unsafeUrl of [
			'javascript:alert(1)',
			'//example.com/credits.html',
			'/music/../admin.html',
		]) {
			expect(musicSchema.safeParse({ ...music, creditsUrl: unsafeUrl }).success).toBe(false);
		}
	});

	it('carries the track control with its title and artist to the player', () => {
		const music = musicSchema.parse({
			url: PLAYABLE_URL,
			title: 'Nuvole Bianche',
			artist: 'Ludovico Einaudi',
			control: 'track',
		});
		const viewModel = adaptEvent(contentDocumentFromEntry(makeMinimalEvent(music)));
		expect(buildPage(viewModel).musicPlayer).toMatchObject({
			title: 'Nuvole Bianche',
			artist: 'Ludovico Einaudi',
			control: 'track',
		});
		expect(musicSchema.safeParse({ url: PLAYABLE_URL, control: 'ticker' }).success).toBe(false);
	});

	describe('adaptEvent', () => {
		it('keeps playable music for the page resolver', () => {
			const viewModel = adaptEvent(
				contentDocumentFromEntry(
					makeMinimalEvent({
						url: `  ${PLAYABLE_URL}  `,
						autoPlay: true,
						title: 'Vals',
					}),
				),
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
			const viewModel = adaptEvent(contentDocumentFromEntry(makeMinimalEvent(music)));
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

		it('does not leak the local empty-player placeholder on a hosted runtime when DEV is true', () => {
			asHostedDeploy('production', { isDevServer: true });

			const fromOmittedMusic = buildPage(baseViewModel);
			const fromBlankMusic = buildPage({
				...baseViewModel,
				music: {
					url: '',
					autoPlay: false,
					title: 'Música de fondo',
					revealMode: 'envelope',
				},
			});

			expect(fromOmittedMusic.musicPlayer).toBeUndefined();
			expect(fromBlankMusic.musicPlayer).toBeUndefined();
		});

		it('does not leak the placeholder on hosted Preview', () => {
			asHostedDeploy('preview', { isDevServer: true });
			expect(buildPage(baseViewModel).musicPlayer).toBeUndefined();
		});
	});

	describe('published content without music', () => {
		it('keeps the player hidden through adaptEvent + page assembly on a hosted runtime', () => {
			asHostedDeploy('production', { isDevServer: true });

			const viewModel = adaptEvent(contentDocumentFromEntry(makeMinimalEvent()));
			const page = buildPage(viewModel);

			expect(viewModel.music).toBeUndefined();
			expect(page.musicPlayer).toBeUndefined();
		});
	});
});
