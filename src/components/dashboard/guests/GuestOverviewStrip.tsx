import React from 'react';
import { MessageGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import GuestPassesBar from '@/components/dashboard/guests/GuestPassesBar';
import type {
	GuestReviewFilterValue,
	GuestSummary,
} from '@/components/dashboard/guests/guest-presenter';
import { formatParty } from '@/lib/rsvp/guest-cap';

interface GuestOverviewStripProps {
	summary: GuestSummary;
	/** Whether the full overview (charts, funnel, groups) is open. */
	expanded: boolean;
	onToggleExpanded: () => void;
	/** Id of the collapsible full overview the toggle controls. */
	fullSummaryId: string;
	activeFilter: GuestReviewFilterValue;
	onFilterChange: (filter: GuestReviewFilterValue) => void;
	/** Invitations with a guest message; zero hides the entry to the message wall. */
	messageCount?: number;
	/** Messages that arrived since the host last read them. */
	newMessageCount?: number;
}

interface StripStat {
	filter: GuestReviewFilterValue;
	swatch: 'confirmed' | 'declined' | 'no-answer';
	label: string;
	count: number;
	note?: string;
}

function plural(count: number, singular: string, pluralForm: string): string {
	return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Where the unanswered guests stand, in people so the parts add up to the count. */
function describePending(stages: GuestSummary['stages']): string | null {
	const parts = [
		stages['to-send'].passes > 0 && `${stages['to-send'].passes} aún sin invitación`,
		stages.unopened.passes > 0 &&
			`${stages.unopened.passes} ${stages.unopened.passes === 1 ? 'no la ha abierto' : 'no la han abierto'}`,
		stages.opened.passes > 0 &&
			`${stages.opened.passes} ${stages.opened.passes === 1 ? 'ya la abrió' : 'ya la abrieron'}`,
	].filter(Boolean);
	return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * The event at a glance: the total of invited people, then three counts that
 * add up to it (attending, not attending, unanswered). Each count filters the
 * list. Unused places of a confirmed invitation count as not attending, so the
 * three always add up. The detail folds behind "Más datos".
 */
const GuestOverviewStrip: React.FC<GuestOverviewStripProps> = ({
	summary,
	expanded,
	onToggleExpanded,
	fullSummaryId,
	activeFilter,
	onFilterChange,
	messageCount = 0,
	newMessageCount = 0,
}) => {
	const { people, stages, invitations } = summary;
	const notAttending = people.declined + people.unused;
	const pending = describePending(stages);

	const stats: StripStat[] = [
		{
			filter: 'confirmed',
			swatch: 'confirmed',
			label: 'Asistirán',
			count: people.confirmed,
			note:
				people.confirmedChildren > 0
					? formatParty(people.confirmed, { children: people.confirmedChildren })
					: undefined,
		},
		{
			filter: 'declined',
			swatch: 'declined',
			label: 'No asistirán',
			count: notAttending,
			note:
				people.unused > 0
					? plural(people.unused, 'lugar sin ocupar', 'lugares sin ocupar')
					: undefined,
		},
		{
			filter: 'no-answer',
			swatch: 'no-answer',
			label: 'Sin confirmar',
			count: people.noAnswer,
		},
	];

	return (
		<section className="guest-strip" aria-label="Resumen del evento">
			<p className="guest-strip__totals">
				<span className="guest-strip__big">{people.assigned}</span>
				<span className="guest-strip__of">
					{people.assigned === 1 ? 'invitado' : 'invitados'} en{' '}
					{plural(invitations, 'invitación', 'invitaciones')}
				</span>
			</p>
			<button
				type="button"
				className="guest-strip__toggle"
				aria-expanded={expanded}
				aria-controls={fullSummaryId}
				onClick={onToggleExpanded}
			>
				{expanded ? 'Ocultar' : 'Más datos'}
			</button>
			<GuestPassesBar
				size="small"
				total={people.assigned}
				label={`${people.confirmed} asistirán, ${notAttending} no asistirán y ${people.noAnswer} sin confirmar, de ${people.assigned} invitados`}
				slices={[
					{ key: 'confirmed', value: people.confirmed },
					{ key: 'declined', value: notAttending },
				]}
			/>
			<div
				className="guest-strip__stats"
				role="group"
				aria-label="Filtrar la lista por respuesta"
			>
				{stats.map((stat) => {
					const active = activeFilter === stat.filter;
					return (
						<button
							key={stat.filter}
							type="button"
							className={`guest-strip__stat${active ? ' guest-strip__stat--active' : ''}`}
							aria-pressed={active}
							onClick={() => onFilterChange(active ? 'all' : stat.filter)}
						>
							<span className="guest-strip__stat-count">
								<span
									className={`guest-overview__swatch guest-overview__swatch--${stat.swatch}`}
									aria-hidden="true"
								/>
								{stat.count}
							</span>
							<span className="guest-strip__stat-label">{stat.label}</span>
							{stat.note && (
								<span className="guest-strip__stat-note">{stat.note}</span>
							)}
						</button>
					);
				})}
			</div>
			{pending && people.noAnswer > 0 && (
				<p className="guest-strip__pending">
					{people.noAnswer === 1
						? 'El invitado sin confirmar: '
						: `De los ${people.noAnswer} sin confirmar: `}
					{pending}
				</p>
			)}
			{messageCount > 0 && (
				<MessagesButton
					total={messageCount}
					unread={newMessageCount}
					open={activeFilter === 'with-message'}
					onToggle={() =>
						onFilterChange(activeFilter === 'with-message' ? 'all' : 'with-message')
					}
				/>
			)}
		</section>
	);
};

interface MessagesButtonProps {
	total: number;
	unread: number;
	open: boolean;
	onToggle: () => void;
}

/** Entry to the message wall; says how many arrived since the last read. */
const MessagesButton: React.FC<MessagesButtonProps> = ({ total, unread, open, onToggle }) => {
	const showUnread = unread > 0 && !open;
	const allUnread = showUnread && unread >= total;
	const label = allUnread
		? plural(total, 'mensaje nuevo', 'mensajes nuevos')
		: plural(total, 'mensaje', 'mensajes');
	const classes = ['guest-strip__messages'];
	if (open) classes.push('guest-strip__messages--active');
	if (showUnread) classes.push('guest-strip__messages--unread');
	return (
		<button type="button" className={classes.join(' ')} aria-pressed={open} onClick={onToggle}>
			<MessageGlyph size={16} />
			<span className="guest-strip__messages-text">{label} de sus invitados</span>
			{showUnread && !allUnread && (
				<span className="guest-strip__messages-new">
					{plural(unread, 'nuevo', 'nuevos')}
				</span>
			)}
			<span className="guest-strip__messages-action">
				{open ? 'Volver a la lista' : 'Leer'}
			</span>
		</button>
	);
};

export default GuestOverviewStrip;
