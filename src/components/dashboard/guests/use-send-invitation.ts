import { useCallback, useMemo, useState } from 'react';
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

function resolveSendPhone(
	editPhone: string,
	savedPhone: string | null | undefined,
): string | null | undefined {
	const trimmed = editPhone.trim();
	if (trimmed) return trimmed;
	return savedPhone ? null : undefined;
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

	const pendingCount = useMemo(
		() => pendingGuests.filter((item) => item.deliveryStatus === 'generated').length,
		[pendingGuests],
	);

	const validPhone = useMemo(() => {
		const trimmed = editPhone.trim();
		if (!trimmed) return false;
		return hasValidPhone(trimmed);
	}, [editPhone]);
	const hasSavedPhone = useMemo(() => !!guest?.phone?.trim(), [guest?.phone]);

	const resetForm = useCallback(() => {
		setShareStatus('idle');
		setFallbackGuest(null);
		setMarkError(null);
		setAdvancing(false);
	}, []);

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

	const executeAfterSave = useCallback(
		async (waWindow: Window | null, updated: DashboardGuestItem) => {
			setFallbackGuest(updated);

			if (updated.waShareUrl) {
				if (waWindow && !waWindow.closed) {
					waWindow.location.href = updated.waShareUrl;
					await markSharedOrFallback(updated);
					return;
				}
				setShareStatus('fallback');
				return;
			}

			setShareStatus('fallback');
		},
		[markSharedOrFallback],
	);

	const handleSaveAndShare = useCallback(async () => {
		if (!guest || shareStatus !== 'idle') return;

		if (!hasSavedPhone) {
			const inviteUrl = getGuestInviteUrl(guest, inviteBaseUrl);
			const payload = buildInvitationSharePayload({
				shareText: guest.shareText,
				inviteUrl,
			});

			setPhoneError(null);
			setShareStatus('sharing');
			setFallbackGuest(guest);
			setMarkError(null);

			const result = await shareInvitationLink(payload);

			if (result === 'shared') {
				await markSharedOrFallback(guest);
				return;
			}

			if (result === 'canceled') {
				setFallbackGuest(null);
				setShareStatus('idle');
				return;
			}

			setShareStatus('fallback');
			return;
		}

		const trimmed = editPhone.trim();
		if (trimmed && !hasValidPhone(trimmed)) {
			setPhoneError('El teléfono debe tener 10 dígitos.');
			return;
		}
		setPhoneError(null);
		setShareStatus('saving');
		setMarkError(null);

		let waWindow: Window | null = null;
		if (validPhone) {
			try {
				waWindow = window.open('', '_blank');
			} catch {
				// popup blocked — will show fallback
			}
		}

		const sendPhone = resolveSendPhone(editPhone, guest.phone);
		try {
			const updated = await onSave(guest.guestId, {
				fullName: editName.trim() || guest.fullName,
				maxAllowedAttendees: editMaxAttendees,
				phone: sendPhone,
				countryCode: sendPhone ? editCountryCode : undefined,
			});

			if (validPhone) {
				await executeAfterSave(waWindow, updated);
				return;
			}

			setFallbackGuest(updated);
			setShareStatus('fallback');
		} catch {
			setPhoneError('Error al guardar los datos. Intenta de nuevo.');
			waWindow?.close();
			setShareStatus('idle');
		}
	}, [
		guest,
		shareStatus,
		hasSavedPhone,
		inviteBaseUrl,
		editPhone,
		editName,
		editMaxAttendees,
		editCountryCode,
		validPhone,
		onSave,
		executeAfterSave,
		markSharedOrFallback,
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
		resetForm();
	}, [resetForm]);

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
		canSendToPhone: hasSavedPhone,
		isNoPhoneGuest: !hasSavedPhone,
		handleSaveAndShare,
		handleCopyOnly,
		handleCopyAndMarkSent,
		handleKeepPending,
		handlePostpone,
	};
}
