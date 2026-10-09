import React from 'react';
import {
	CheckGlyph,
	ClockGlyph,
	DeclinedGlyph,
	OpenedGlyph,
	SentGlyph,
} from '@/components/dashboard/guests/GuestGlyphs';
import { getPrimaryStatus, type GuestStage } from '@/components/dashboard/guests/guest-presenter';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';

const STAGE_ICON: Record<GuestStage, React.FC<{ size?: number }>> = {
	'to-send': ClockGlyph,
	unopened: SentGlyph,
	opened: OpenedGlyph,
	confirmed: CheckGlyph,
	declined: DeclinedGlyph,
};

/** Stage label with its own icon, so states differ by shape and not only by color. */
const GuestStatusPill: React.FC<{ item: DashboardGuestItem }> = ({ item }) => {
	const status = getPrimaryStatus(item);
	const Icon = STAGE_ICON[status.class];
	return (
		<span className={`status-pill status-pill--${status.class}`}>
			<Icon size={14} />
			{status.label}
		</span>
	);
};

export default GuestStatusPill;
