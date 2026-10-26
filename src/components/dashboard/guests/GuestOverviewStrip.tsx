import React from 'react';
import GuestPassesBar from '@/components/dashboard/guests/GuestPassesBar';
import type {
	GuestReviewFilterValue,
	GuestSummary,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestOverviewStripProps {
	summary: GuestSummary;
	activeFilter: GuestReviewFilterValue;
	onFilterChange: (filter: GuestReviewFilterValue) => void;
	/** Whether the full overview (charts, funnel, groups) is open. */
	expanded: boolean;
	onToggleExpanded: () => void;
	/** Id of the collapsible full overview the toggle controls. */
	fullSummaryId: string;
}

interface StripPill {
	filter: GuestReviewFilterValue;
	tone: 'to-send' | 'awaiting' | 'confirmed' | 'declined';
	count: number;
	label: string;
}

/**
 * Compact-screen summary: one headline, the passes bar and a pill per state that
 * filters the list, so the pending work and the list share the first screen.
 */
const GuestOverviewStrip: React.FC<GuestOverviewStripProps> = ({
	summary,
	activeFilter,
	onFilterChange,
	expanded,
	onToggleExpanded,
	fullSummaryId,
}) => {
	const { people, stages, awaitingAnswer } = summary;
	const percent =
		people.assigned > 0 ? Math.round((people.confirmed / people.assigned) * 100) : 0;
	const pills: StripPill[] = [
		{
			filter: 'delivery-pending',
			tone: 'to-send',
			count: stages['to-send'].invitations,
			label: 'por enviar',
		},
		{
			filter: 'confirmation-pending',
			tone: 'awaiting',
			count: awaitingAnswer.invitations,
			label: 'sin responder',
		},
		{
			filter: 'confirmed',
			tone: 'confirmed',
			count: stages.confirmed.invitations,
			label: stages.confirmed.invitations === 1 ? 'confirmada' : 'confirmadas',
		},
		{
			filter: 'declined',
			tone: 'declined',
			count: stages.declined.invitations,
			label: 'no asistirán',
		},
	];
	const visiblePills = pills.filter((pill) => pill.count > 0 || activeFilter === pill.filter);

	return (
		<section className="guest-strip" aria-label="Resumen breve de invitados">
			<p className="guest-strip__headline">
				<span className="guest-strip__big">{people.confirmed}</span>
				<span className="guest-strip__of">
					de {people.assigned}{' '}
					{people.assigned === 1 ? 'pase confirmado' : 'pases confirmados'}
					{people.assigned > 0 && ` · ${percent} %`}
				</span>
			</p>
			<GuestPassesBar
				size="small"
				total={people.assigned}
				label={`${people.confirmed} de ${people.assigned} pases confirmados`}
				slices={[
					{ key: 'confirmed', value: people.confirmed },
					{ key: 'declined', value: people.declined },
					{ key: 'unused', value: people.unused },
				]}
			/>
			{visiblePills.length > 0 && (
				<div
					className="guest-strip__pills"
					role="group"
					aria-label="Filtrar invitaciones por estado"
				>
					{visiblePills.map((pill) => {
						const active = activeFilter === pill.filter;
						return (
							<button
								key={pill.filter}
								type="button"
								className={`guest-strip__pill guest-strip__pill--${pill.tone}${active ? ' guest-strip__pill--active' : ''}`}
								aria-pressed={active}
								onClick={() => onFilterChange(active ? 'all' : pill.filter)}
							>
								{pill.count} {pill.label}
							</button>
						);
					})}
				</div>
			)}
			<button
				type="button"
				className="guest-strip__toggle"
				aria-expanded={expanded}
				aria-controls={fullSummaryId}
				onClick={onToggleExpanded}
			>
				{expanded ? 'Ocultar resumen completo' : 'Ver resumen completo'}
			</button>
		</section>
	);
};

export default GuestOverviewStrip;
