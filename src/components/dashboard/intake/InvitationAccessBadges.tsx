import type { FC } from 'react';
import {
	INVITATION_PAYMENT_STATUS_LABELS,
	INVITATION_PUBLIC_ACCESS_LABELS,
	type InvitationAccessRecord,
} from '@/lib/invitation/access/invitation-access-command';

interface Props {
	access: Pick<InvitationAccessRecord, 'paymentStatus' | 'publicAccess'>;
	/** Show the calm states (paid, visible) too, not only those that need attention. */
	showAll?: boolean;
}

/** Payment and public-access badges; by default only states that need attention. */
const InvitationAccessBadges: FC<Props> = ({ access, showAll = false }) => {
	const unpaid = access.paymentStatus === 'unpaid';
	const disabled = access.publicAccess === 'disabled';
	if (!showAll && !unpaid && !disabled) return null;
	return (
		<span className="invitation-access-badges">
			{(showAll || unpaid) && (
				<span
					className={`dashboard-badge ${unpaid ? 'dashboard-badge--pending' : 'dashboard-badge--active'}`}
				>
					{INVITATION_PAYMENT_STATUS_LABELS[access.paymentStatus]}
				</span>
			)}
			{(showAll || disabled) && (
				<span
					className={`dashboard-badge ${disabled ? 'dashboard-badge--disabled' : 'dashboard-badge--active'}`}
				>
					{INVITATION_PUBLIC_ACCESS_LABELS[access.publicAccess]}
				</span>
			)}
		</span>
	);
};

export default InvitationAccessBadges;
