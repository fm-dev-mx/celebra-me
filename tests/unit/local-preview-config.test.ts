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

describe('local invitation preview config', () => {
	beforeEach(() => {
		isDev.mockReturnValue(false);
	});

	it('treats blank music URLs as not playable', () => {
		expect(hasPlayableMusicUrl(undefined)).toBe(false);
		expect(hasPlayableMusicUrl('')).toBe(false);
		expect(hasPlayableMusicUrl('   ')).toBe(false);
		expect(hasPlayableMusicUrl('https://cdn.example/song.mp3')).toBe(true);
	});

	it('hides empty music and guest-less PA in Preview and Production', () => {
		expect(shouldShowMusicPlayer('')).toBe(false);
		expect(shouldShowLocalPersonalizedAccessPreview()).toBe(false);
		expect(shouldShowMusicPlayer('https://cdn.example/song.mp3')).toBe(true);
		expect(
			resolveInvitationMusicPlayer({
				music: undefined,
				envelopeEnabled: true,
			}),
		).toBeUndefined();
	});

	it('honors the local constants only inside astro dev', () => {
		isDev.mockReturnValue(true);
		expect(shouldShowMusicPlayer('')).toBe(LOCAL_INVITATION_PREVIEW.showMusicPlayerWithoutUrl);
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
