import { useCallback, useMemo, useRef, useState } from 'react';
import type { ShareFlowMode } from '@/components/dashboard/guests/guest-presenter';
import { DEFAULT_COUNTRY_CODE } from '@/lib/phone/country-codes';
import {
	buildInvitationSharePayload,
	shareInvitationLink,
} from '@/components/dashboard/guests/invitation-share';
import { useMessageEditor } from '@/components/dashboard/guests/use-message-editor';
import { copyToClipboard } from '@/utils/clipboard';
import { hasValidPhone, buildWhatsAppNumber } from '@/lib/phone/validation';
import { renderShareMessage } from '@/lib/rsvp/services/shared/share-message-renderer';
import {
	resolveReminderTemplate,
	type ShareMessagesConfig,
} from '@/lib/rsvp/services/shared/share-message-defaults';
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
	onReminderSent?: (guestId: string) => void;
	onAdvanceFromGuest?: (currentGuestId: string) => void;
	onPostponeGuest?: (currentGuestId: string) => void;
	onDone?: () => void;
	templates?: ShareMessagesConfig;
	shareDateContext?: ShareMessageDateContext;
	eventTitle?: string;
	mode?: ShareFlowMode;
}

/**
 * Determines phone to send in save payload.
 * - user-entered text → use it (string)
 * - empty + guest has saved → null (clear the field)
 * - empty + guest has none → undefined (don't update)
 */
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

	if (trimmedPhone && editCountryCode !== (guest.countryCode ?? DEFAULT_COUNTRY_CODE))
		return true;

	return false;
}

export function useSendInvitation({
	guest,
	pendingGuests,
	inviteUrl,
	onSave,
	onMarkShared,
	onReminderSent,
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
	const [editCountryCode, setEditCountryCode] = useState(
		guest?.countryCode ?? DEFAULT_COUNTRY_CODE,
	);
	const [phoneError, setPhoneError] = useState<string | null>(null);
	const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');
	const [fallbackGuest, setFallbackGuest] = useState<DashboardGuestItem | null>(null);
	const [markError, setMarkError] = useState<string | null>(null);
	const [advancing, setAdvancing] = useState(false);

	const savingRef = useRef(false);

	const isQueueMode = mode === 'pending-invitation' || mode === 'pending-reminder';
	const isReminderMode = mode === 'pending-reminder' || mode === 'single-reminder';

	const pendingCount = isQueueMode ? pendingGuests.length : 0;

	const trimmedPhone = editPhone.trim();
	const validPhone = !!trimmedPhone && hasValidPhone(trimmedPhone);

	/** Save guest data if changed. Returns null if no guest, throws on failure. */
	const trySave = useCallback(async (): Promise<DashboardGuestItem | null> => {
		if (!guest) return null;
		if (!hasDataChanged(guest, editName, editMaxAttendees, editPhone, editCountryCode)) {
			return guest;
		}
		return await onSave(
			guest.guestId,
			buildSavePayload(guest, editName, editMaxAttendees, editPhone, editCountryCode),
		);
	}, [guest, editName, editMaxAttendees, editPhone, editCountryCode, onSave]);

	const initiatePreShare = useCallback(
		(target: DashboardGuestItem) => {
			if (isReminderMode) {
				onReminderSent?.(target.guestId);
				return { shareAttempt: Promise.resolve(), retryShare: false };
			}
			let retry = false;
			const p = onMarkShared(target).catch(() => {
				retry = true;
			});
			return { shareAttempt: p, retryShare: retry };
		},
		[isReminderMode, onReminderSent, onMarkShared],
	);

	/** Await pre-share result and retry once if it failed. */
	const completeShare = useCallback(
		async (shareAttempt: Promise<void>, target: DashboardGuestItem, retryShare: boolean) => {
			await shareAttempt;
			if (retryShare && !isReminderMode) {
				try {
					await onMarkShared(target);
				} catch {
					setMarkError('Error al registrar el envío.');
					setShareStatus('fallback');
					return;
				}
			}
			if (isQueueMode) onAdvanceFromGuest?.(target.guestId);
			if (!isQueueMode) onDone?.();
		},
		[
			onMarkShared,
			onAdvanceFromGuest,
			onDone,
			isQueueMode,
			isReminderMode,
			setMarkError,
			setShareStatus,
		],
	);

	const renderedMessage = useMemo(() => {
		if (!templates || !guest) return guest?.shareText || '';
		const kind = isReminderMode
			? 'reminder'
			: resolveDefaultMessageKind({
					firstSharedAt: guest.firstSharedAt,
					attendanceStatus: guest.attendanceStatus,
					deliveryStatus: guest.deliveryStatus,
				});
		const template = templates[kind];
		const effectiveTemplate =
			kind === 'reminder'
				? resolveReminderTemplate(template, guest.attendanceStatus)
				: template;
		return renderShareMessage(effectiveTemplate, {
			guestName: editName || guest.fullName,
			eventTitle: eventTitle || '',
			inviteUrl,
			attendanceStatus: guest.attendanceStatus,
			...(shareDateContext || {}),
		});
	}, [templates, guest, editName, eventTitle, inviteUrl, shareDateContext, isReminderMode]);

	const {
		editingMessage,
		localMessageOverride,
		messageError,
		copySuccess,
		activeMessage,
		handleEditMessage,
		handleCancelEditMessage,
		handleResetMessage,
		handleUpdateLocalMessage,
		handleCopyMessageAction,
		handleValidateMessage,
		handleClearValidationState,
		resetMessageState,
	} = useMessageEditor({ renderedMessage, inviteUrl, guest, trySave });

	const handleSaveAndShare = useCallback(async () => {
		if (!guest || shareStatus !== 'idle') return;
		if (savingRef.current) return;

		const trimmed = editPhone.trim();
		if (trimmed && !hasValidPhone(trimmed)) {
			setPhoneError(
				'Revisa el número de WhatsApp o déjalo vacío para elegir el contacto manualmente.',
			);
			return;
		}

		if (editingMessage && !handleValidateMessage()) {
			return;
		}

		setPhoneError(null);
		handleClearValidationState();
		savingRef.current = true;
		setShareStatus('saving');
		setMarkError(null);

		try {
			const target = await trySave();
			if (!target) return;

			const phoneNumber = validPhone
				? buildWhatsAppNumber(
						editPhone || target.phone,
						editCountryCode || target.countryCode,
					)
				: '';

			const waUrl = phoneNumber
				? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(activeMessage)}`
				: `https://wa.me/?text=${encodeURIComponent(activeMessage)}`;

			// Start idempotent mark-shared ("share handoff initiated") before
			// opening the share channel. The optimistic update is synchronous so
			// the dashboard immediately reflects the new state. Do NOT await yet
			// — preserve the synchronous user gesture for window.open.
			const { shareAttempt, retryShare } = initiatePreShare(target);
			setFallbackGuest(target);
			const waWindow = window.open(waUrl, '_blank', 'noopener,noreferrer');

			if (waWindow && !waWindow.closed) {
				await completeShare(shareAttempt, target, retryShare);
				return;
			}

			const payload = buildInvitationSharePayload({
				shareText: activeMessage,
				inviteUrl,
			});
			const result = await shareInvitationLink(payload);

			if (result === 'shared') {
				await completeShare(shareAttempt, target, retryShare);
				return;
			}

			if (result === 'canceled') {
				setFallbackGuest(null);
				setShareStatus('idle');
				return;
			}

			const copied = await copyToClipboard(activeMessage);
			if (copied) {
				await completeShare(shareAttempt, target, retryShare);
				return;
			}

			setShareStatus('fallback');
		} catch {
			setMarkError('Error al guardar los cambios.');
			setShareStatus('idle');
		} finally {
			savingRef.current = false;
		}
	}, [
		guest,
		shareStatus,
		editPhone,
		editName,
		editMaxAttendees,
		editCountryCode,
		validPhone,
		editingMessage,
		activeMessage,
		inviteUrl,
		trySave,
		isReminderMode,
		initiatePreShare,
		completeShare,
		handleValidateMessage,
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
			if (!isReminderMode) {
				await onMarkShared(fallbackGuest);
			} else {
				onReminderSent?.(fallbackGuest.guestId);
			}
			if (isQueueMode) {
				onAdvanceFromGuest?.(fallbackGuest.guestId);
			}
		} catch {
			setMarkError('Error al registrar el envío.');
		} finally {
			setAdvancing(false);
		}
	}, [
		fallbackGuest,
		advancing,
		inviteUrl,
		onMarkShared,
		onReminderSent,
		onAdvanceFromGuest,
		isQueueMode,
		isReminderMode,
	]);

	const handleKeepPending = useCallback(() => {
		savingRef.current = false;
		setShareStatus('idle');
		resetMessageState();
		setFallbackGuest(null);
		setMarkError(null);
		setAdvancing(false);
	}, [resetMessageState]);

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
		isReminderMode,
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
