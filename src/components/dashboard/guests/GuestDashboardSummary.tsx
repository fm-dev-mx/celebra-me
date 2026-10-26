import React from 'react';
import GuestGroupMetrics from '@/components/dashboard/guests/GuestGroupMetrics';
import GuestOverviewStrip from '@/components/dashboard/guests/GuestOverviewStrip';
import GuestStatusOverview, {
	GuestNextStep,
	type GuestStatusOverviewProps,
} from '@/components/dashboard/guests/GuestStatusOverview';
import type { GroupMetric } from '@/components/dashboard/guests/guest-presenter';
import { useGuestSummaryExpanded } from '@/components/dashboard/guests/use-guest-summary-expanded';

const FULL_SUMMARY_ID = 'guest-summary-full';

interface GuestDashboardSummaryProps {
	/** False while loading or after a load error. */
	showOverview: boolean;
	overview: GuestStatusOverviewProps;
	groupMetrics: GroupMetric[];
	activeGroup: string;
	onSelectGroup: (group: string) => void;
}

/**
 * Event summary above the guest list. Compact screens lead with the strip and the
 * next step, and fold the full overview and "Por grupo" behind "Ver resumen completo";
 * wide screens always show the full overview. An empty event keeps it unfolded.
 */
const GuestDashboardSummary: React.FC<GuestDashboardSummaryProps> = ({
	showOverview,
	overview,
	groupMetrics,
	activeGroup,
	onSelectGroup,
}) => {
	const [expanded, setExpanded] = useGuestSummaryExpanded();
	const showStrip = showOverview && overview.summary.invitations > 0;
	const scope = overview.nextStepScope;

	return (
		<>
			{showStrip && (
				<div className="dashboard-guests__lead">
					<GuestOverviewStrip
						summary={overview.summary}
						activeFilter={overview.activeFilter}
						onFilterChange={overview.onFilterChange}
						expanded={expanded}
						onToggleExpanded={() => setExpanded(!expanded)}
						fullSummaryId={FULL_SUMMARY_ID}
					/>
					<GuestNextStep
						placement="strip"
						summary={scope?.summary ?? overview.summary}
						reminderCount={scope?.reminderCount ?? overview.reminderCount ?? 0}
						scopeLabel={scope?.label}
						reminderHint={overview.reminderHint ?? null}
						onRemind={overview.onRemind}
						onSendPending={overview.onSendPending}
					/>
				</div>
			)}

			<div
				id={FULL_SUMMARY_ID}
				className={`dashboard-guests__summary${showStrip && !expanded ? ' dashboard-guests__summary--folded' : ''}`}
			>
				{showOverview && <GuestStatusOverview {...overview} />}
				<GuestGroupMetrics
					metrics={groupMetrics}
					activeGroup={activeGroup}
					onSelectGroup={onSelectGroup}
				/>
			</div>
		</>
	);
};

export default GuestDashboardSummary;
