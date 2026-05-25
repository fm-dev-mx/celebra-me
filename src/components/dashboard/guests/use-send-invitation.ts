import { useCallback, useState } from 'react';
import { getGuestInviteUrl } from '@/components/dashboard/guests/guest-presenter';
import {
	buildInvitationSharePayload,
	shareInvitationLink,
} from '@/components/dashboard/guests/invitation-share';
import { hasValidPhone } from '@/lib/phone/validation';
import { copyToClipboard } from '@/utils/clipboard';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

type ShareStatus = 'idle' | 'saving' | 'sharing' | 'fallback';

interface UseSendInvitationOptions {
	guest: DashboardGuestItem | null;
	pendingGuests: DashboardGuestItem[];
	inviteBaseUrl: string;
	onSave: (
		guestId: string,
		payload: {
			fullName: string;
			maxAllowedAttendees: number;
			phone?: string | null;
			countryCode?: string;
		},
	) => Promise<DashboardGuestItem>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onAdvanceFromGuest: (currentGuestId: string) => void;
	onPostponeGuest: (currentGuestId: string) => void;
}

function resolveSendPhone(editPhone: string, savedPhone: string): string | null | undefined {
	const trimmed = editPhone.trim();
	if (trimmed) return trimmed;
	return savedPhone ? null : undefined;
}

function tryOpenWhatsAppWindow(): Window | null {
	try {
		return window.open('', '_blank');
	} catch {
		return null;
	}
}

export function useSendInvitation({
	guest,
	pendingGuests,
	inviteBaseUrl,
	onSave,
	onMarkShared,
	onAdvanceFromGuest,
	onPostponeGuest,
}: UseSendInvitationOptions) {
	const [editName, setEditName] = useState(guest?.fullName ?? '');
	const [editMaxAttendees, setEditMaxAttendees] = useState(guest?.maxAllowedAttendees ?? 1);
	const [editPhone, setEditPhone] = useState(guest?.phone ?? '');
	const [editCountryCode, setEditCountryCode] = useState(guest?.countryCode ?? '+52');
	const [phoneError, setPhoneError] = useState<string | null>(null);
	const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
	const [fallbackGuest, setFallbackGuest] = useState<DashboardGuestItem | null>(null);
	const [markError, setMarkError] = useState<string | null>(null);
	const [advancing, setAdvancing] = useState(false);

	const pendingCount = pendingGuests.filter((item) => item.deliveryStatus === 'generated').length;

	const trimmedPhone = editPhone.trim();
	const validPhone = !!trimmedPhone && hasValidPhone(trimmedPhone);

	const markSharedOrFallback = useCallback(
		async (updated: DashboardGuestItem) => {
			try {
				await onMarkShared(updated);
				onAdvanceFromGuest(updated.guestId);
			} catch {
				setMarkError('Error al registrar el envío.');
				setShareStatus('fallback');
			}
		},
		[onMarkShared, onAdvanceFromGuest],
	);

	const handleWhatsAppFlow = useCallback(
		async (waWindow: Window | null, updated: DashboardGuestItem) => {
			setFallbackGuest(updated);
			if (updated.waShareUrl && waWindow && !waWindow.closed) {
				waWindow.location.href = updated.waShareUrl;
				await markSharedOrFallback(updated);
				return;
			}
			setShareStatus('fallback');
		},
		[markSharedOrFallback],
	);

	const handleNativeShareFlow = useCallback(
		async (updated: DashboardGuestItem) => {
			setShareStatus('sharing');
			setFallbackGuest(updated);
			const inviteUrl = getGuestInviteUrl(updated, inviteBaseUrl);
			const payload = buildInvitationSharePayload({
				shareText: updated.shareText,
				inviteUrl,
			});

			const result = await shareInvitationLink(payload);

			if (result === 'shared') {
				await markSharedOrFallback(updated);
				return;
			}

			if (result === 'canceled') {
				setFallbackGuest(null);
				setShareStatus('idle');
				return;
			}

			setShareStatus('fallback');
		},
		[inviteBaseUrl, markSharedOrFallback],
	);

	const handleSaveAndShare = useCallback(async () => {
		if (!guest || shareStatus !== 'idle') return;

		const trimmed = editPhone.trim();
		if (trimmed && !hasValidPhone(trimmed)) {
			setPhoneError('El teléfono debe tener 10 dígitos.');
			return;
		}
		setPhoneError(null);
		setShareStatus('saving');
		setMarkError(null);

		const waWindow = validPhone ? tryOpenWhatsAppWindow() : null;
		const sendPhone = resolveSendPhone(editPhone, guest.phone);

		try {
			const updated = await onSave(guest.guestId, {
				fullName: editName.trim() || guest.fullName,
				maxAllowedAttendees: editMaxAttendees,
				phone: sendPhone,
				countryCode: sendPhone ? editCountryCode : undefined,
			});

			if (validPhone) {
				await handleWhatsAppFlow(waWindow, updated);
				return;
			}

			await handleNativeShareFlow(updated);
		} catch {
			setPhoneError('Error al guardar los datos. Intenta de nuevo.');
			waWindow?.close();
			setShareStatus('idle');
		}
	}, [
		guest,
		shareStatus,
		inviteBaseUrl,
		editPhone,
		editName,
		editMaxAttendees,
		editCountryCode,
		validPhone,
		onSave,
		handleWhatsAppFlow,
		handleNativeShareFlow,
	]);

	const handleCopyOnly = useCallback(async () => {
		if (!fallbackGuest) return;
		const inviteUrl = getGuestInviteUrl(fallbackGuest, inviteBaseUrl);
		const copied = await copyToClipboard(inviteUrl);
		if (!copied) {
			window.open(inviteUrl, '_blank', 'noopener,noreferrer');
		}
	}, [fallbackGuest, inviteBaseUrl]);

	const handleCopyAndMarkSent = useCallback(async () => {
		if (!fallbackGuest || advancing) return;
		setAdvancing(true);
		setMarkError(null);
		try {
			const inviteUrl = getGuestInviteUrl(fallbackGuest, inviteBaseUrl);
			const copied = await copyToClipboard(inviteUrl);
			if (!copied) {
				window.open(inviteUrl, '_blank', 'noopener,noreferrer');
			}
			await onMarkShared(fallbackGuest);
			onAdvanceFromGuest(fallbackGuest.guestId);
		} catch {
			setMarkError('Error al registrar el envío.');
		} finally {
			setAdvancing(false);
		}
	}, [fallbackGuest, advancing, inviteBaseUrl, onMarkShared, onAdvanceFromGuest]);

	const handleKeepPending = useCallback(() => {
		setShareStatus('idle');
		setFallbackGuest(null);
		setMarkError(null);
		setAdvancing(false);
	}, []);

	const handlePostpone = useCallback(() => {
		if (!guest) return;
		onPostponeGuest(guest.guestId);
	}, [guest, onPostponeGuest]);

	return {
		editName,
		setEditName,
		editMaxAttendees,
		setEditMaxAttendees,
		editPhone,
		setEditPhone,
		editCountryCode,
		setEditCountryCode,
		phoneError,
		setPhoneError,
		shareStatus,
		fallbackGuest,
		markError,
		advancing,
		pendingCount,
		canSendToPhone: validPhone,
		handleSaveAndShare,
		handleCopyOnly,
		handleCopyAndMarkSent,
		handleKeepPending,
		handlePostpone,
	};
}
