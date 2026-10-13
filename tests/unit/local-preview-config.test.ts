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
	const originalDeployEnv = process.env.CELEBRA_DEPLOY_ENV;

	beforeEach(() => {
		isDev.mockReturnValue(false);
		delete process.env.CELEBRA_DEPLOY_ENV;
	});

	afterEach(() => {
		if (originalDeployEnv === undefined) {
			delete process.env.CELEBRA_DEPLOY_ENV;
		} else {
			process.env.CELEBRA_DEPLOY_ENV = originalDeployEnv;
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
			process.env.CELEBRA_DEPLOY_ENV = 'production';
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
			).toBeUndefined();
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

		it.each([['production'], ['preview']])(
			'ignores local preview switches when hosted as %s even if DEV is true',
			(deployEnvironment) => {
				isDev.mockReturnValue(true);
				process.env.CELEBRA_DEPLOY_ENV = deployEnvironment;

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

	it('never enables local previews in a hosted runtime', () => {
		isDev.mockReturnValue(true);
		process.env.CELEBRA_DEPLOY_ENV = 'production';

		expect(shouldShowMusicPlayer('')).toBe(false);
		expect(shouldShowLocalPersonalizedAccessPreview()).toBe(false);
	});
});

describe('public local parity defaults', () => {
	it('does not inject guest passes or empty music into ordinary public routes', () => {
		expect(LOCAL_INVITATION_PREVIEW).toEqual({
			showPersonalizedAccessWithoutGuest: false,
			showMusicPlayerWithoutUrl: false,
		});
	});
});
