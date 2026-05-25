export interface InvitationSharePayload {
	title: string;
	text: string;
	url: string;
}

export type InvitationShareResult = 'shared' | 'unsupported' | 'canceled' | 'failed';

export function buildInvitationSharePayload(params: {
	shareText: string;
	inviteUrl: string;
}): InvitationSharePayload {
	return {
		title: 'Invitación Celebra-me',
		text: params.shareText,
		url: params.inviteUrl,
	};
}

export function canUseNativeShare(payload?: InvitationSharePayload): boolean {
	if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
	if (payload && typeof navigator.canShare === 'function') {
		try {
			return navigator.canShare(payload);
		} catch {
			return false;
		}
	}
	return true;
}

export function isShareAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

export async function shareInvitationLink(
	payload: InvitationSharePayload,
): Promise<InvitationShareResult> {
	if (!canUseNativeShare(payload)) return 'unsupported';

	try {
		await navigator.share(payload);
		return 'shared';
	} catch (error) {
		return isShareAbortError(error) ? 'canceled' : 'failed';
	}
}
