import { useCallback, useMemo, useState } from 'react';
import { getGuestInviteUrl } from '@/components/dashboard/guests/guest-presenter';
import {
	buildInvitationSharePayload,
	shareInvitationLink,
} from '@/components/dashboard/guests/invitation-share';
import { hasValidPhone, buildWhatsAppNumber } from '@/lib/phone/validation';
import { copyToClipboard } from '@/utils/clipboard';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
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
	templates?: ShareMessagesConfig;
	shareDateContext?: ShareMessageDateContext;
	eventTitle?: string;
}

function resolveSendPhone(editPhone: string, savedPhone: string): string | null | undefined {
	const trimmed = editPhone.trim();
	if (trimmed) return trimmed;
	return savedPhone ? null : undefined;
}

function buildSavePayload(
	guest: DashboardGuestItem,
	editName: string,
	editMaxAttendees: number,
	editPhone: string,
	editCountryCode: string,
) {
	const sendPhone = resolveSendPhone(editPhone, guest.phone);
	return {
		fullName: editName.trim() || guest.fullName,
		maxAllowedAttendees: editMaxAttendees,
		phone: sendPhone,
		countryCode: sendPhone ? editCountryCode : undefined,
	};
}

export function useSendInvitation({
	guest,
	pendingGuests,
	inviteBaseUrl,
	onSave,
	onMarkShared,
	onAdvanceFromGuest,
	onPostponeGuest,
	templates,
	shareDateContext,
	eventTitle,
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
	const [editingMessage, setEditingMessage] = useState(false);
	const [localMessageOverride, setLocalMessageOverride] = useState('');
	const [messageError, setMessageError] = useState<string | null>(null);

	const pendingCount = pendingGuests.filter((item) => item.deliveryStatus === 'generated').length;

	const trimmedPhone = editPhone.trim();
	const validPhone = !!trimmedPhone && hasValidPhone(trimmedPhone);

	const inviteUrl = useMemo(
		() => (guest ? getGuestInviteUrl(guest, inviteBaseUrl) : ''),
		[guest, inviteBaseUrl],
	);

	const renderedMessage = useMemo(() => {
		if (!templates || !guest) return guest?.shareText || '';
		const template = templates.invitation;
		return renderShareMessage(template, {
			guestName: editName || guest.fullName,
			eventTitle: eventTitle || '',
			inviteUrl,
			...(shareDateContext || {}),
		});
	}, [templates, guest, editName, eventTitle, inviteUrl, shareDateContext]);

	const activeMessage = useMemo(
		() => localMessageOverride || renderedMessage,
		[localMessageOverride, renderedMessage],
	);

	const markSharedOrFallback = useCallback(
		async (updated: DashboardGuestItem) => {
			setFallbackGuest(updated);
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

	const handleEditMessage = useCallback(() => {
		setEditingMessage(true);
		setLocalMessageOverride(activeMessage);
		setMessageError(null);
	}, [activeMessage]);

	const handleCancelEditMessage = useCallback(() => {
		setEditingMessage(false);
		setLocalMessageOverride('');
		setMessageError(null);
	}, []);

	const handleUpdateLocalMessage = useCallback((text: string) => {
		setLocalMessageOverride(text);
		setMessageError(null);
	}, []);

	const handleCopyMessageAction = useCallback(async () => {
		if (!guest) return;
		const text = localMessageOverride || renderedMessage;
		if (!text?.trim()) {
			setMessageError('El mensaje no puede estar vacío.');
			return;
		}
		const copied = await copyToClipboard(text);
		if (copied) {
			setShareStatus('saving');
			try {
				const updated = await onSave(
					guest.guestId,
					buildSavePayload(guest, editName, editMaxAttendees, editPhone, editCountryCode),
				);
				await markSharedOrFallback(updated);
			} catch {
				setPhoneError('Error al guardar los datos. Intenta de nuevo.');
				setShareStatus('idle');
			}
		} else {
			setMessageError('No se pudo copiar el mensaje.');
		}
	}, [
		guest,
		localMessageOverride,
		renderedMessage,
		editPhone,
		editName,
		editMaxAttendees,
		editCountryCode,
		onSave,
		markSharedOrFallback,
	]);

	const handleSaveAndShare = useCallback(async () => {
		if (!guest || shareStatus !== 'idle') return;

		const trimmed = editPhone.trim();
		if (trimmed && !hasValidPhone(trimmed)) {
			setPhoneError('El teléfono debe tener 10 dígitos.');
			return;
		}

		if (editingMessage && !localMessageOverride.trim()) {
			setMessageError('El mensaje no puede estar vacío.');
			return;
		}

		setPhoneError(null);
		setMessageError(null);
		setShareStatus('saving');
		setMarkError(null);

		try {
			const updated = await onSave(
				guest.guestId,
				buildSavePayload(guest, editName, editMaxAttendees, editPhone, editCountryCode),
			);

			if (validPhone) {
				const waPhone = buildWhatsAppNumber(
					editPhone || updated.phone,
					editCountryCode || updated.countryCode,
				);
				if (!waPhone) {
					setShareStatus('fallback');
					setFallbackGuest(updated);
					return;
				}
				const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(activeMessage)}`;
				const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');
				setFallbackGuest(updated);
				if (waWindow && !waWindow.closed) {
					await markSharedOrFallback(updated);
					return;
				}
				setShareStatus('fallback');
				return;
			}

			const url = getGuestInviteUrl(updated, inviteBaseUrl);
			const payload = buildInvitationSharePayload({
				shareText: activeMessage,
				inviteUrl: url,
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

			const copied = await copyToClipboard(activeMessage);
			if (copied) {
				await markSharedOrFallback(updated);
				return;
			}

			setShareStatus('fallback');
			setFallbackGuest(updated);
		} catch {
			setPhoneError('Error al guardar los datos. Intenta de nuevo.');
			setShareStatus('idle');
		}
	}, [
		guest,
		shareStatus,
		editPhone,
		editName,
		editMaxAttendees,
		editCountryCode,
		validPhone,
		onSave,
		inviteBaseUrl,
		activeMessage,
		localMessageOverride,
		editingMessage,
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
		setShareStatus('idle');
		setEditingMessage(false);
		setLocalMessageOverride('');
		setMessageError(null);
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
		editingMessage,
		activeMessage,
		localMessageOverride,
		messageError,
		handleEditMessage,
		handleCancelEditMessage,
		handleUpdateLocalMessage,
		handleCopyMessageAction,
		handleSaveAndShare,
		handleCopyOnly,
		handleCopyAndMarkSent,
		handleKeepPending,
		handlePostpone,
	};
}
