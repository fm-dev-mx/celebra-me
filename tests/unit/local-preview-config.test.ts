import { isDevEnvironment } from '@/lib/environment';
import {
	LOCAL_INVITATION_PREVIEW,
	hasPlayableMusicUrl,
	resolveInvitationMusicPlayer,
	shouldShowLocalPersonalizedAccessPreview,
	shouldShowMusicPlayer,
} from '@/lib/invitation/local-preview-config';

jest.mock('@/lib/environment', () => ({
	isDevEnvironment: jest.fn(() => false),
}));

const isDev = isDevEnvironment as jest.MockedFunction<typeof isDevEnvironment>;

const PLAYABLE_URL = 'https://cdn.example/song.mp3';

describe('local invitation preview config', () => {
	const originalVercel = process.env.VERCEL;
	const originalVercelEnv = process.env.VERCEL_ENV;

	beforeEach(() => {
		isDev.mockReturnValue(false);
		delete process.env.VERCEL;
		delete process.env.VERCEL_ENV;
	});

	afterEach(() => {
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

	describe('hasPlayableMusicUrl', () => {
		it.each([
			['undefined', undefined],
			['empty string', ''],
			['whitespace', '   '],
			['newline', '\n\t'],
			['null', null],
		])('rejects %s', (_label, url) => {
			expect(hasPlayableMusicUrl(url)).toBe(false);
		});

		it('accepts a non-empty URL', () => {
			expect(hasPlayableMusicUrl(PLAYABLE_URL)).toBe(true);
			expect(hasPlayableMusicUrl(`  ${PLAYABLE_URL}  `)).toBe(true);
		});
	});

	describe('happy paths', () => {
		it('shows a playable URL on a non-hosted production-like runtime', () => {
			expect(shouldShowMusicPlayer(PLAYABLE_URL)).toBe(true);
			expect(
				resolveInvitationMusicPlayer({
					music: {
						url: PLAYABLE_URL,
						autoPlay: true,
						title: 'Canción de entrada',
					},
					envelopeEnabled: true,
				}),
			).toEqual({
				url: PLAYABLE_URL,
				autoPlay: true,
				title: 'Canción de entrada',
				revealMode: 'envelope',
				variant: 'standard',
			});
		});

		it('trims playable URLs and defaults autoPlay when omitted', () => {
			expect(
				resolveInvitationMusicPlayer({
					music: { url: `  ${PLAYABLE_URL}  ` },
					envelopeEnabled: false,
				}),
			).toEqual({
				url: PLAYABLE_URL,
				autoPlay: false,
				title: undefined,
				revealMode: 'immediate',
				variant: 'standard',
			});
		});

		it('keeps an explicit revealMode over the envelope default', () => {
			expect(
				resolveInvitationMusicPlayer({
					music: { url: PLAYABLE_URL, revealMode: 'immediate' },
					envelopeEnabled: true,
				}),
			).toMatchObject({ revealMode: 'immediate' });
		});

		it('still shows a playable URL on hosted Preview and Production', () => {
			isDev.mockReturnValue(true);
			process.env.VERCEL = '1';
			process.env.VERCEL_ENV = 'production';
			expect(shouldShowMusicPlayer(PLAYABLE_URL)).toBe(true);
			expect(
				resolveInvitationMusicPlayer({
					music: { url: PLAYABLE_URL, title: 'Pista' },
					envelopeEnabled: true,
				}),
			).toMatchObject({ url: PLAYABLE_URL, title: 'Pista' });
		});

		it('honors local preview constants only inside astro dev', () => {
			isDev.mockReturnValue(true);
			expect(shouldShowMusicPlayer('')).toBe(
				LOCAL_INVITATION_PREVIEW.showMusicPlayerWithoutUrl,
			);
			expect(shouldShowLocalPersonalizedAccessPreview()).toBe(
				LOCAL_INVITATION_PREVIEW.showPersonalizedAccessWithoutGuest,
			);
			expect(
				resolveInvitationMusicPlayer({
					music: undefined,
					envelopeEnabled: true,
				}),
			).toEqual({
				url: '',
				autoPlay: false,
				title: undefined,
				revealMode: 'envelope',
				variant: 'standard',
			});
		});
	});

	describe('sad paths', () => {
		it('hides empty music and guest-less PA when DEV is false', () => {
			expect(shouldShowMusicPlayer('')).toBe(false);
			expect(shouldShowLocalPersonalizedAccessPreview()).toBe(false);
			expect(
				resolveInvitationMusicPlayer({
					music: undefined,
					envelopeEnabled: true,
				}),
			).toBeUndefined();
		});

		it.each([
			['undefined music', undefined],
			['empty url', { url: '' }],
			['whitespace url', { url: '   ' }],
		])('does not assemble a player for %s outside local preview', (_label, music) => {
			expect(
				resolveInvitationMusicPlayer({
					music,
					envelopeEnabled: true,
				}),
			).toBeUndefined();
		});

		it.each([
			['VERCEL=1', { VERCEL: '1' }],
			['VERCEL_ENV=production', { VERCEL_ENV: 'production' }],
			['VERCEL_ENV=preview', { VERCEL_ENV: 'preview' }],
			['VERCEL=1 and production', { VERCEL: '1', VERCEL_ENV: 'production' }],
			['VERCEL=1 and preview', { VERCEL: '1', VERCEL_ENV: 'preview' }],
		])(
			'ignores local preview switches when hosted via %s even if DEV is true',
			(_label, env) => {
				isDev.mockReturnValue(true);
				if ('VERCEL' in env) process.env.VERCEL = env.VERCEL;
				if ('VERCEL_ENV' in env) process.env.VERCEL_ENV = env.VERCEL_ENV;

				expect(shouldShowMusicPlayer('')).toBe(false);
				expect(shouldShowMusicPlayer('   ')).toBe(false);
				expect(shouldShowLocalPersonalizedAccessPreview()).toBe(false);
				expect(
					resolveInvitationMusicPlayer({
						music: undefined,
						envelopeEnabled: true,
					}),
				).toBeUndefined();
				expect(
					resolveInvitationMusicPlayer({
						music: { url: '   ', title: 'Música de fondo' },
						envelopeEnabled: true,
					}),
				).toBeUndefined();
			},
		);
	});

	it('never enables local previews in a Vercel runtime', () => {
		isDev.mockReturnValue(true);
		process.env.VERCEL_ENV = 'production';

		expect(shouldShowMusicPlayer('')).toBe(false);
		expect(shouldShowLocalPersonalizedAccessPreview()).toBe(false);
	});
});
