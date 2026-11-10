import React from 'react';
import type { GuestSummary } from '@/components/dashboard/guests/guest-presenter';
import { formatParty } from '@/lib/rsvp/guest-cap';

interface GuestConfirmedPartyProps {
	people: GuestSummary['people'];
	className: string;
}

/** Adults and children among the confirmed people; nothing while no child is confirmed. */
const GuestConfirmedParty: React.FC<GuestConfirmedPartyProps> = ({ people, className }) => {
	if (people.confirmedChildren === 0) return null;
	return (
		<span className={className}>
			{formatParty(people.confirmed, { children: people.confirmedChildren })}
		</span>
	);
};

export default GuestConfirmedParty;
