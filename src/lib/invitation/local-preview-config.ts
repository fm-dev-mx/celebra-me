import { isDevEnvironment } from '@/lib/environment';
import { getEnv } from '@/lib/server/env';

/**
 * Local `astro dev` invitation preview switches.
 *
 * Hosted Preview and Production ignore these flags and follow published content.
 * Flip a boolean here to disable a local-only preview. Do not use env vars.
 */
export const LOCAL_INVITATION_PREVIEW = {
	showPersonalizedAccessWithoutGuest: true,
	showMusicPlayerWithoutUrl: true,
} as const;

export type InvitationMusicPlayerProps = {
	url: string;
	autoPlay: boolean;
	title?: string;
	revealMode: 'envelope' | 'immediate';
	variant?: string;
};

function isHostedInvitationRuntime(): boolean {
	const vercel = getEnv('VERCEL');
	const vercelEnv = getEnv('VERCEL_ENV').toLowerCase();
	return vercel === '1' || vercelEnv === 'production' || vercelEnv === 'preview';
}

function canUseLocalInvitationPreview(): boolean {
	if (isHostedInvitationRuntime()) return false;
	return isDevEnvironment();
}

export function hasPlayableMusicUrl(url: string | undefined | null): boolean {
	return Boolean(url?.trim());
}

export function shouldShowLocalPersonalizedAccessPreview(): boolean {
	return (
		canUseLocalInvitationPreview() && LOCAL_INVITATION_PREVIEW.showPersonalizedAccessWithoutGuest
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
		revealMode: input.music?.revealMode ?? (input.envelopeEnabled ? 'envelope' : 'immediate'),
		variant: 'standard',
	};
}
