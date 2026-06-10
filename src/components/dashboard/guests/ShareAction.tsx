import { useState } from 'react';
import { MessageIcon } from '@/components/common/icons/ui';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import { getShareCtaLabel } from '@/components/dashboard/guests/guest-presenter';
import ShareComposer from '@/components/dashboard/guests/ShareComposer';

interface ShareActionProps {
	guest: DashboardGuestItem;
	inviteUrl: string;
	eventTitle: string;
	shareTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	onShared: () => Promise<void> | void;
}

type ShareStatus = 'idle' | 'sending' | 'delivered';

const ShareAction: React.FC<ShareActionProps> = ({
	guest,
	inviteUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
	onShared,
}) => {
	const [status, setStatus] = useState<ShareStatus>('idle');
	const [composerOpen, setComposerOpen] = useState(false);

	const cta = getShareCtaLabel(guest);

	const icon =
		status === 'sending' ? (
			<span className="share-icon share-icon--state">...</span>
		) : status === 'delivered' ? (
			<span className="share-icon share-icon--state">OK</span>
		) : (
			<MessageIcon className="share-icon" size={16} />
		);

	const label = status === 'sending' ? 'Enviando' : status === 'delivered' ? 'Listo' : cta.label;

	return (
		<>
			<button
				type="button"
				className={`dashboard-guests__share-button dashboard-guests__share-button--${status} ${guest.deliveryStatus === 'shared' && status === 'idle' ? 'dashboard-guests__share-button--shared' : ''}`}
				onClick={() => setComposerOpen(true)}
				disabled={status !== 'idle'}
				title={cta.label}
				aria-label={cta.label}
			>
				{icon}
				<span className="share-label">{label}</span>
			</button>
			{composerOpen && (
				<ShareComposer
					guestName={guest.fullName}
					phone={guest.phone}
					countryCode={guest.countryCode}
					inviteUrl={inviteUrl}
					eventTitle={eventTitle}
					templates={shareTemplates}
					shareDateContext={shareDateContext}
					defaultMessageType={cta.defaultMessageType}
					onShared={async () => {
						setStatus('sending');
						await onShared();
						setStatus('delivered');
					}}
					onClose={() => {
						setComposerOpen(false);
						setTimeout(() => setStatus('idle'), 1500);
					}}
				/>
			)}
		</>
	);
};

export default ShareAction;
