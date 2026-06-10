import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ShareFlowMode } from '@/components/dashboard/guests/guest-presenter';
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
import { resolveDefaultMessageKind } from '@/lib/rsvp/services/shared/message-type-resolver';

type ShareStatus = 'idle' | 'saving' | 'sharing' | 'fallback';

interface UseSendInvitationOptions {
	guest: DashboardGuestItem | null;
	pendingGuests: DashboardGuestItem[];
	inviteUrl: string;
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
	onAdvanceFromGuest?: (currentGuestId: string) => void;
	onPostponeGuest?: (currentGuestId: string) => void;
	onDone?: () => void;
	templates?: ShareMessagesConfig;
	shareDateContext?: ShareMessageDateContext;
	eventTitle?: string;
	mode?: ShareFlowMode;
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

function hasDataChanged(
	guest: DashboardGuestItem,
	editName: string,
	editMaxAttendees: number,
	editPhone: string,
	editCountryCode: string,
): boolean {
	if (editName.trim() !== guest.fullName) return true;
	if (editMaxAttendees !== guest.maxAllowedAttendees) return true;

	const trimmedPhone = editPhone.trim();
	const savedPhone = guest.phone ?? '';
	if (trimmedPhone !== savedPhone) return true;

	if (trimmedPhone && editCountryCode !== (guest.countryCode ?? '+52')) return true;

	return false;
}

export function useSendInvitation({
	guest,
	pendingGuests,
	inviteUrl,
	onSave,
	onMarkShared,
	onAdvanceFromGuest,
	onPostponeGuest,
	onDone,
	templates,
	shareDateContext,
	eventTitle,
	mode = 'pending-invitation',
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
	const [copySuccess, setCopySuccess] = useState(false);

	useEffect(() => {
		if (!copySuccess) return;
		const id = setTimeout(() => setCopySuccess(false), 2000);
		return () => clearTimeout(id);
	}, [copySuccess]);

	const isQueueMode = mode === 'pending-invitation';

	const pendingCount = isQueueMode
		? pendingGuests.filter((item) => item.deliveryStatus === 'generated').length
		: 0;

	const trimmedPhone = editPhone.trim();
	const validPhone = !!trimmedPhone && hasValidPhone(trimmedPhone);

	const renderedMessage = useMemo(() => {
		if (!templates || !guest) return guest?.shareText || '';
		const kind =
			mode === 'single-reminder'
				? 'reminder'
				: resolveDefaultMessageKind({
						firstSharedAt: guest.firstSharedAt,
						attendanceStatus: guest.attendanceStatus,
						deliveryStatus: guest.deliveryStatus,
					});
		const template = templates[kind];
		return renderShareMessage(template, {
			guestName: editName || guest.fullName,
			eventTitle: eventTitle || '',
			inviteUrl,
			...(shareDateContext || {}),
		});
	}, [templates, guest, editName, eventTitle, inviteUrl, shareDateContext, mode]);

	const activeMessage = useMemo(
		() => localMessageOverride || renderedMessage,
		[localMessageOverride, renderedMessage],
	);

	const trySave = useCallback(async (): Promise<DashboardGuestItem> => {
		if (!guest) return guest;
		if (!hasDataChanged(guest, editName, editMaxAttendees, editPhone, editCountryCode)) {
			return guest;
		}
		try {
			return await onSave(
				guest.guestId,
				buildSavePayload(guest, editName, editMaxAttendees, editPhone, editCountryCode),
			);
		} catch {
			return guest;
		}
	}, [guest, editName, editMaxAttendees, editPhone, editCountryCode, onSave]);

	const markSharedOrFallback = useCallback(
		async (updated: DashboardGuestItem) => {
			setFallbackGuest(updated);
			try {
				await onMarkShared(updated);
				if (isQueueMode) {
					onAdvanceFromGuest?.(updated.guestId);
				}
			} catch {
				setMarkError('Error al registrar el envío.');
				setShareStatus('fallback');
			}
		},
		[onMarkShared, onAdvanceFromGuest, isQueueMode],
	);

	const markSharedAndComplete = useCallback(
		async (item: DashboardGuestItem) => {
			await markSharedOrFallback(item);
			if (!isQueueMode) onDone?.();
		},
		[markSharedOrFallback, onDone, isQueueMode],
	);

	const handleEditMessage = useCallback(() => {
		setCopySuccess(false);
		setEditingMessage(true);
		setLocalMessageOverride(activeMessage);
		setMessageError(null);
	}, [activeMessage]);

	const handleCancelEditMessage = useCallback(() => {
		setEditingMessage(false);
		setLocalMessageOverride('');
		setMessageError(null);
	}, []);

	const handleResetMessage = useCallback(() => {
		setLocalMessageOverride(renderedMessage);
		setMessageError(null);
	}, [renderedMessage]);

	const handleUpdateLocalMessage = useCallback((text: string) => {
		setLocalMessageOverride(text);
		setMessageError(null);
	}, []);

	const handleCopyMessageAction = useCallback(async () => {
		if (!guest) return;
		setCopySuccess(false);
		const text = localMessageOverride || renderedMessage;
		if (!text?.trim()) {
			setMessageError('El mensaje no puede estar vacío.');
			return;
		}
		const copied = await copyToClipboard(text);
		if (!copied) {
			setMessageError('No se pudo copiar el mensaje.');
			return;
		}

		await trySave();
		setCopySuccess(true);
	}, [guest, localMessageOverride, renderedMessage, trySave]);

	const handleSaveAndShare = useCallback(async () => {
		if (!guest || shareStatus !== 'idle') return;

		const trimmed = editPhone.trim();
		if (trimmed && !hasValidPhone(trimmed)) {
			setPhoneError(
				'Revisa el número de WhatsApp o déjalo vacío para elegir el contacto manualmente.',
			);
			return;
		}

		if (editingMessage && !localMessageOverride.trim()) {
			setMessageError('El mensaje no puede estar vacío.');
			return;
		}

		setPhoneError(null);
		setMessageError(null);
		setCopySuccess(false);
		setShareStatus('saving');
		setMarkError(null);

		const target = await trySave();

		const phoneNumber = validPhone
			? buildWhatsAppNumber(editPhone || target.phone, editCountryCode || target.countryCode)
			: '';

		const waUrl = phoneNumber
			? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(activeMessage)}`
			: `https://wa.me/?text=${encodeURIComponent(activeMessage)}`;

		const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');
		setFallbackGuest(target);

		if (waWindow && !waWindow.closed) {
			await markSharedAndComplete(target);
			return;
		}

		const payload = buildInvitationSharePayload({
			shareText: activeMessage,
			inviteUrl,
		});
		const result = await shareInvitationLink(payload);

		if (result === 'shared') {
			await markSharedAndComplete(target);
			return;
		}

		if (result === 'canceled') {
			setFallbackGuest(null);
			setShareStatus('idle');
			return;
		}

		const copied = await copyToClipboard(activeMessage);
		if (copied) {
			await markSharedAndComplete(target);
			return;
		}

		setShareStatus('fallback');
	}, [
		guest,
		shareStatus,
		editPhone,
		editName,
		editMaxAttendees,
		editCountryCode,
		validPhone,
		editingMessage,
		localMessageOverride,
		activeMessage,
		trySave,
		markSharedAndComplete,
	]);

	const handleCopyOnly = useCallback(async () => {
		if (!fallbackGuest) return;
		const copied = await copyToClipboard(inviteUrl);
		if (!copied) {
			window.open(inviteUrl, '_blank', 'noopener,noreferrer');
		}
	}, [fallbackGuest, inviteUrl]);

	const handleCopyAndMarkSent = useCallback(async () => {
		if (!fallbackGuest || advancing) return;
		setAdvancing(true);
		setMarkError(null);
		try {
			const copied = await copyToClipboard(inviteUrl);
			if (!copied) {
				window.open(inviteUrl, '_blank', 'noopener,noreferrer');
			}
			await onMarkShared(fallbackGuest);
			if (isQueueMode) {
				onAdvanceFromGuest?.(fallbackGuest.guestId);
			}
		} catch {
			setMarkError('Error al registrar el envío.');
		} finally {
			setAdvancing(false);
		}
	}, [fallbackGuest, advancing, inviteUrl, onMarkShared, onAdvanceFromGuest, isQueueMode]);

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
		onPostponeGuest?.(guest.guestId);
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
		isQueueMode,
		copySuccess,
		handleEditMessage,
		handleCancelEditMessage,
		handleResetMessage,
		handleUpdateLocalMessage,
		handleCopyMessageAction,
		handleSaveAndShare,
		handleCopyOnly,
		handleCopyAndMarkSent,
		handleKeepPending,
		handlePostpone,
	};
}
