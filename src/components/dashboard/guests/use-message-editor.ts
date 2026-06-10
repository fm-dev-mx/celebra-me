import { useCallback, useEffect, useMemo, useState } from 'react';
import { copyToClipboard } from '@/utils/clipboard';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

interface UseMessageEditorOptions {
	renderedMessage: string;
	inviteUrl: string;
	guest: DashboardGuestItem | null;
	trySave: () => Promise<DashboardGuestItem | null>;
}

function ensureInviteUrl(message: string, inviteUrl: string): string {
	const trimmedMessage = message.trim();
	const trimmedInviteUrl = inviteUrl.trim();

	if (!trimmedInviteUrl) return trimmedMessage;

	if (trimmedMessage.includes(trimmedInviteUrl)) {
		return trimmedMessage;
	}

	return `${trimmedMessage}\n\n${trimmedInviteUrl}`;
}

export function useMessageEditor({
	renderedMessage,
	inviteUrl,
	guest,
	trySave,
}: UseMessageEditorOptions) {
	const [editingMessage, setEditingMessage] = useState(false);
	const [localMessageOverride, setLocalMessageOverride] = useState('');
	const [messageError, setMessageError] = useState<string | null>(null);
	const [copySuccess, setCopySuccess] = useState(false);

	useEffect(() => {
		if (!copySuccess) return;
		const id = setTimeout(() => setCopySuccess(false), 2000);
		return () => clearTimeout(id);
	}, [copySuccess]);

	useEffect(() => {
		setLocalMessageOverride('');
		setEditingMessage(false);
		setMessageError(null);
	}, [guest?.guestId]);

	const activeMessage = useMemo(
		() => ensureInviteUrl(localMessageOverride || renderedMessage, inviteUrl),
		[localMessageOverride, renderedMessage, inviteUrl],
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
		if (!activeMessage?.trim()) {
			setMessageError('El mensaje no puede estar vacío.');
			return;
		}
		const copied = await copyToClipboard(activeMessage);
		if (!copied) {
			setMessageError('No se pudo copiar el mensaje.');
			return;
		}

		await trySave();
		setCopySuccess(true);
	}, [guest, activeMessage, trySave]);

	const resetMessageState = useCallback(() => {
		setEditingMessage(false);
		setLocalMessageOverride('');
		setMessageError(null);
		setCopySuccess(false);
	}, []);

	return {
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
		resetMessageState,
		setMessageError,
		setCopySuccess,
	};
}
