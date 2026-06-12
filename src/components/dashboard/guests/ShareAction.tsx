import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageIcon } from '@/components/common/icons/ui';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	getShareCtaLabel,
	hasBeenShared,
	resolveShareFlowMode,
	type ShareFlowMode,
} from '@/components/dashboard/guests/guest-presenter';
import SendInvitationModal from '@/components/dashboard/guests/SendInvitationModal';

interface ShareActionProps {
	guest: DashboardGuestItem;
	inviteUrl: string;
	eventTitle: string;
	shareTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	onShared: () => Promise<void> | void;
	onSaveGuest?: (
		guestId: string,
		payload: {
			fullName: string;
			maxAllowedAttendees: number;
			phone?: string | null;
			countryCode?: string;
		},
	) => Promise<DashboardGuestItem>;
}

type ShareStatus = 'idle' | 'sending' | 'delivered';

const ShareAction: React.FC<ShareActionProps> = ({
	guest,
	inviteUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
	onShared,
	onSaveGuest,
}) => {
	const [status, setStatus] = useState<ShareStatus>('idle');
	const [composerOpen, setComposerOpen] = useState(false);
	const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => {
		return () => clearTimeout(idleTimerRef.current);
	}, []);

	const cta = getShareCtaLabel(guest);
	const mode: ShareFlowMode = resolveShareFlowMode(guest);
	const isPrimary = !hasBeenShared(guest) || guest.attendanceStatus === 'pending';
	const priorityBtnClass = status === 'idle' && isPrimary ? 'btn-primary' : 'btn-secondary';

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
				onClick={() => setComposerOpen(true)}
				disabled={status !== 'idle'}
				title={cta.label}
				aria-label={cta.label}
			>
				{icon}
				<span className="share-label">{label}</span>
			</button>
			{composerOpen && (
				<SendInvitationModal
					guest={guest}
					pendingGuests={[]}
					inviteUrl={inviteUrl}
					onClose={() => {
						setComposerOpen(false);
						idleTimerRef.current = setTimeout(() => setStatus('idle'), 1500);
					}}
					onSave={onSaveGuest ?? (async () => guest)}
					onMarkShared={handleMarkShared}
					templates={shareTemplates}
					shareDateContext={shareDateContext}
					eventTitle={eventTitle}
					mode={mode}
				/>
			)}
		</>
	);
};

export default ShareAction;
