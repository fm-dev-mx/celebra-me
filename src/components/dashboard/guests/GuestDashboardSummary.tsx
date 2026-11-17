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
	/** Invitations with a guest message; opens the message wall from the strip. */
	messageCount?: number;
	newMessageCount?: number;
}

/**
 * Event summary above the guest list: progress and the next step stay in view,
 * and the detail (pass tiles, stages, deadline, "Por grupo") folds behind
 * "Más datos" at every width. An empty event keeps the overview unfolded.
 */
const GuestDashboardSummary: React.FC<GuestDashboardSummaryProps> = ({
	showOverview,
	overview,
	groupMetrics,
	activeGroup,
	onSelectGroup,
	messageCount = 0,
	newMessageCount = 0,
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
						expanded={expanded}
						onToggleExpanded={() => setExpanded(!expanded)}
						fullSummaryId={FULL_SUMMARY_ID}
						activeFilter={overview.activeFilter}
						onFilterChange={overview.onFilterChange}
						messageCount={messageCount}
						newMessageCount={newMessageCount}
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
				{showOverview && <GuestStatusOverview {...overview} hideNextStep={showStrip} />}
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
