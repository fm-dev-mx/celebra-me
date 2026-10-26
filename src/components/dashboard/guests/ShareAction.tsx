import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageIcon } from '@/components/common/icons/ui';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	getShareCtaLabel,
	hasBeenShared,
	resolveShareFlowMode,
} from '@/components/dashboard/guests/guest-presenter';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';

interface ShareActionProps {
	guest: DashboardGuestItem;
	inviteUrl: string;
	eventTitle: string;
	shareTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	onShared: () => Promise<void> | void;
	/** Table rows keep every button outlined; the filled style belongs to the page's main action. */
	outlined?: boolean;
	onSaveGuest?: (
		guestId: string,
		payload: {
			fullName: string;
			maxAllowedAttendees: number;
			phone?: string | null;
			countryCode?: string;
		},
	) => Promise<DashboardGuestItem>;
	/** Called when the composer opens, and again when it closes or this action unmounts. */
	onComposerOpenChange?: (open: boolean) => void;
}

type ShareStatus = 'idle' | 'sending' | 'delivered';

const ShareAction: React.FC<ShareActionProps> = ({
	guest,
	inviteUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
	onShared,
	outlined = false,
	onSaveGuest,
	onComposerOpenChange,
}) => {
	const [status, setStatus] = useState<ShareStatus>('idle');
	// The guest as it was when the composer opened: marking as sent mid-flow must not turn
	// an invitation composer (mode, template, fallback actions) into a reminder one.
	const [composerGuest, setComposerGuest] = useState<DashboardGuestItem | null>(null);
	const composerOpen = composerGuest !== null;
	const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const onComposerOpenChangeRef = useRef(onComposerOpenChange);

	useEffect(() => {
		onComposerOpenChangeRef.current = onComposerOpenChange;
	}, [onComposerOpenChange]);

	useEffect(() => {
		return () => clearTimeout(idleTimerRef.current);
	}, []);

	useEffect(() => {
		if (!composerOpen) return;
		onComposerOpenChangeRef.current?.(true);
		return () => onComposerOpenChangeRef.current?.(false);
	}, [composerOpen]);

	const cta = getShareCtaLabel(guest);
	const isPrimary = !hasBeenShared(guest) || guest.attendanceStatus === 'pending';
	const priorityBtnClass =
		status === 'idle' && isPrimary && !outlined ? 'btn-primary' : 'btn-secondary';

	const icon =
		status === 'sending' ? (
			<span className="share-icon share-icon--state">...</span>
		) : status === 'delivered' ? (
			<span className="share-icon share-icon--state">OK</span>
		) : (
			<MessageIcon className="share-icon" size={16} />
		);

	const label = status === 'sending' ? 'Enviando' : status === 'delivered' ? 'Listo' : cta.label;

	const handleMarkShared = useCallback(async () => {
		setStatus('sending');
		await onShared();
		setStatus('delivered');
	}, [onShared]);

	return (
		<>
			<button
				type="button"
				className={`${priorityBtnClass} dashboard-guests__share-button dashboard-guests__share-button--${status} ${guest.deliveryStatus === 'shared' && status === 'idle' ? 'dashboard-guests__share-button--shared' : ''}`}
				onClick={() => setComposerGuest(guest)}
				disabled={status !== 'idle'}
				title={cta.label}
				aria-label={cta.label}
			>
				{icon}
				<span className="share-label">{label}</span>
			</button>
			{composerGuest && (
				<SendInvitationModal
					guest={composerGuest}
					pendingGuests={[]}
					inviteUrl={inviteUrl}
					onClose={() => {
						setComposerGuest(null);
						idleTimerRef.current = setTimeout(() => setStatus('idle'), 1500);
					}}
					onSave={onSaveGuest ?? (async () => composerGuest)}
					onMarkShared={handleMarkShared}
					templates={shareTemplates}
					shareDateContext={shareDateContext}
					eventTitle={eventTitle}
					mode={resolveShareFlowMode(composerGuest)}
				/>
			)}
		</>
	);
};

export default ShareAction;
