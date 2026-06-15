import type { FC } from 'react';
import { FieldRow, formatValue } from '@/components/intake/shared/FieldRow';
import { VENUE_LABELS } from '@/lib/intake/labels';

interface VenueSectionProps {
	title: string;
	venue: Record<string, unknown> | undefined;
}

const SKIP_KEYS = new Set(['coordinates']);

export const VenueSection: FC<VenueSectionProps> = ({ title, venue }) => {
	if (!venue) return null;
	const entries = Object.entries(venue).filter(
		([key, v]) => !key.startsWith('_') && !SKIP_KEYS.has(key) && formatValue(v) !== null,
	);
	if (entries.length === 0) return null;
	return (
		<div className="intake-review__venue">
			<h4 className="intake-review__venue-title">{title}</h4>
			<dl className="intake-review__fields">
				{entries.map(([key, val]) => (
					<FieldRow key={key} label={VENUE_LABELS[key] ?? key} value={val} />
				))}
			</dl>
		</div>
	);
};
