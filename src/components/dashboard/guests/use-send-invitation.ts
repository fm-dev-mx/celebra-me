import { useCallback, useMemo, useState } from 'react';
import { getGuestInviteUrl, validatePhone } from '@/components/dashboard/guests/guest-presenter';
import { copyToClipboard } from '@/utils/clipboard';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

type ShareStatus = 'idle' | 'saving' | 'fallback';

interface UseSendInvitationOptions {
	guest: DashboardGuestItem | null;
	pendingGuests: DashboardGuestItem[];
	inviteBaseUrl: string;
	onSave: (
		guestId: string,
		payload: {
			fullName: string;
			maxAllowedAttendees: number;
			phone?: string;
			countryCode?: string;
		},
	) => Promise<DashboardGuestItem>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onAdvanceFromGuest: (currentGuestId: string) => void;
	onPostponeGuest: (currentGuestId: string) => void;
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

	const hasValidPhone = useMemo(() => {
		const trimmed = editPhone.trim();
		if (!trimmed) return false;
		return validatePhone(trimmed);
	}, [editPhone]);

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

	const shareViaNavigator = useCallback(
		async (updated: DashboardGuestItem, inviteUrl: string): Promise<boolean> => {
			if (typeof navigator === 'undefined' || !navigator.share) return false;
			await navigator.share({
				title: 'Invitación Celebra-me',
				text: updated.shareText,
				url: inviteUrl,
			});
			return true;
		},
		[],
	);

	const executeAfterSave = useCallback(
		async (
			waWindow: Window | null,
			hasValidPhone: boolean,
			updated: DashboardGuestItem,
			inviteUrl: string,
		) => {
			setFallbackGuest(updated);

			if (hasValidPhone && updated.waShareUrl) {
				if (waWindow && !waWindow.closed) {
					waWindow.location.href = updated.waShareUrl;
					await markSharedOrFallback(updated);
					return;
				}
				setShareStatus('fallback');
				return;
			}

			try {
				const shared = await shareViaNavigator(updated, inviteUrl);
				if (shared) {
					await markSharedOrFallback(updated);
					return;
				}
			} catch {
				// fallback below
			}
			setShareStatus('fallback');
		},
		[markSharedOrFallback, shareViaNavigator],
	);

	const handleSaveAndShare = useCallback(async () => {
		if (!guest || shareStatus !== 'idle') return;

		const trimmed = editPhone.trim();
		if (trimmed && !validatePhone(trimmed)) {
			setPhoneError('El teléfono debe tener 10 dígitos.');
			return;
		}
		setPhoneError(null);
		setShareStatus('saving');
		setMarkError(null);

		let waWindow: Window | null = null;
		if (hasValidPhone) {
			try {
				waWindow = window.open('', '_blank');
			} catch {
				// popup blocked — will show fallback
			}
		}

		const sendPhone = editPhone.trim() || undefined;
		try {
			const updated = await onSave(guest.guestId, {
				fullName: editName.trim() || guest.fullName,
				maxAllowedAttendees: editMaxAttendees,
				phone: sendPhone,
				countryCode: sendPhone ? editCountryCode : undefined,
			});

			const inviteUrl = getGuestInviteUrl(updated, inviteBaseUrl);
			await executeAfterSave(waWindow, hasValidPhone, updated, inviteUrl);
		} catch {
			setPhoneError('Error al guardar los datos. Intenta de nuevo.');
			waWindow?.close();
			setShareStatus('idle');
		}
	}, [
		guest,
		shareStatus,
		editPhone,
		editName,
		editMaxAttendees,
		editCountryCode,
		hasValidPhone,
		onSave,
		inviteBaseUrl,
		executeAfterSave,
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
		hasValidPhone,
		resetForm,
		handleSaveAndShare,
		handleCopyOnly,
		handleCopyAndMarkSent,
		handleKeepPending,
		handlePostpone,
	};
}
