import { isDevEnvironment } from '@/lib/environment';
import { readHostedDeployEnvironment } from '@/lib/server/deploy-identity';

/**
 * Local `astro dev` invitation preview switches.
 *
 * Hosted Preview and Production ignore these flags and follow published content.
 * Flip a boolean here to disable a local-only preview. Do not use env vars.
 */
export const LOCAL_INVITATION_PREVIEW = {
	showPersonalizedAccessWithoutGuest: false,
	showMusicPlayerWithoutUrl: false,
} as const;

export type InvitationMusicPlayerProps = {
	url: string;
	autoPlay: boolean;
	title?: string;
	creditsUrl?: string;
	startAt?: number;
	fadeInSeconds?: number;
	revealMode: 'envelope' | 'immediate';
	variant?: string;
};

function canUseLocalInvitationPreview(): boolean {
	return readHostedDeployEnvironment() === null && isDevEnvironment();
}

export function hasPlayableMusicUrl(url: string | undefined | null): boolean {
	return Boolean(url?.trim());
}

export function shouldShowLocalPersonalizedAccessPreview(): boolean {
	return (
		canUseLocalInvitationPreview() &&
		LOCAL_INVITATION_PREVIEW.showPersonalizedAccessWithoutGuest
	);
}

export function shouldShowMusicPlayer(url: string | undefined | null): boolean {
	if (hasPlayableMusicUrl(url)) return true;
	return canUseLocalInvitationPreview() && LOCAL_INVITATION_PREVIEW.showMusicPlayerWithoutUrl;
}

export function resolveInvitationMusicPlayer(input: {
	music?: {
		url?: string;
		autoPlay?: boolean;
		title?: string;
		creditsUrl?: string;
		startAt?: number;
		fadeInSeconds?: number;
		revealMode?: 'envelope' | 'immediate';
	};
	envelopeEnabled: boolean;
}): InvitationMusicPlayerProps | undefined {
	const url = input.music?.url;
	if (!shouldShowMusicPlayer(url)) return undefined;
	return {
		url: url?.trim() ?? '',
		autoPlay: input.music?.autoPlay ?? false,
		title: input.music?.title,
		creditsUrl: input.music?.creditsUrl,
		startAt: input.music?.startAt,
		fadeInSeconds: input.music?.fadeInSeconds,
		revealMode: input.music?.revealMode ?? (input.envelopeEnabled ? 'envelope' : 'immediate'),
		variant: 'standard',
	};
}
