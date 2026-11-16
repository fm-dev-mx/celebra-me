import React, { useState } from 'react';
import GuestConfirmedParty from '@/components/dashboard/guests/GuestConfirmedParty';
import GuestEngagementFunnel from '@/components/dashboard/guests/GuestEngagementFunnel';
import GuestPassesBar from '@/components/dashboard/guests/GuestPassesBar';
import type { DashboardEngagementSummary } from '@/interfaces/dashboard/guest.interface';
import { formatParty, formatPassBreakdown } from '@/lib/rsvp/guest-cap';
import { WhatsAppIcon } from '@/components/common/icons/social/WhatsApp';
import { CheckIcon, CopyIcon } from '@/components/common/icons/ui';
import { writeClipboardText } from '@/hooks/use-clipboard';
import {
	buildGuestSummaryShareText,
	formatSummaryParty,
	type GuestReviewFilterValue,
	type GuestSummary,
} from '@/components/dashboard/guests/guest-presenter';

export interface GuestStatusOverviewProps {
	summary: GuestSummary;
	activeFilter: GuestReviewFilterValue;
	onFilterChange: (filter: GuestReviewFilterValue) => void;
	/** Guests eligible for a reminder right now; shows the reminder step when above zero. */
	reminderCount?: number;
	/** Context for the reminder step, e.g. days left before the event. */
	reminderHint?: string | null;
	/**
	 * Set when the progress strip already leads the page: the overview then drops
	 * the next step, the headline and the bar it would repeat, and keeps the detail.
	 */
	hideNextStep?: boolean;
	/** Formatted RSVP deadline; empty when the event has none. */
	rsvpDeadline?: string;
	eventTitle?: string;
	onRemind?: () => void;
	onSendPending?: () => void;
	/** Active group filter: the next step then speaks for that group only. */
	nextStepScope?: { label: string; summary: GuestSummary; reminderCount: number };
	/** Guest engagement funnel; hidden when unavailable. */
	engagement?: DashboardEngagementSummary | null;
}

interface StageButton {
	filter: GuestReviewFilterValue;
	label: string;
	count: number;
	detail: string;
	/** Adults and children of those passes; only when some pass is for children. */
	party?: string;
}

function plural(count: number, singular: string, pluralForm: string): string {
	return count === 1 ? singular : pluralForm;
}

function passes(count: number): string {
	return formatParty(count);
}

/** People count in the summary's own word: "3 invitados". */
function guests(count: number): string {
	return formatParty(count, { unit: 'invitado' });
}

/** Adults/children split under the headline; absent when no pass includes children. */
const GuestPartyBreakdown: React.FC<{ people: GuestSummary['people'] }> = ({ people }) => {
	if (people.assignedChildren === 0) return null;
	return (
		<dl className="guest-overview__breakdown">
			{people.confirmedChildren > 0 && (
				<div className="guest-overview__breakdown-row">
					<dt>Confirmadas</dt>
					<dd>
						<GuestConfirmedParty people={people} className="guest-overview__party" />
					</dd>
				</div>
			)}
			<div className="guest-overview__breakdown-row">
				<dt>Pases</dt>
				<dd>{formatParty(people.assigned, { children: people.assignedChildren })}</dd>
			</div>
		</dl>
	);
};

function percentOf(part: number, total: number): number {
	return total > 0 ? (part / total) * 100 : 0;
}

type ShareState = 'idle' | 'copied' | 'failed';

interface GuestNextStepProps {
	summary: GuestSummary;
	reminderCount: number;
	reminderHint: string | null;
	onRemind?: () => void;
	onSendPending?: () => void;
	/** Group name when the list is filtered by group. */
	scopeLabel?: string;
	/**
	 * `strip` leads the compact screen above the list and keeps its action button;
	 * `overview` sits in the full summary, which compact screens collapse.
	 */
	placement?: 'overview' | 'strip';
}

/** The one thing worth doing next: send the unsent, then remind the unanswered, or nothing. */
export const GuestNextStep: React.FC<GuestNextStepProps> = ({
	summary,
	reminderCount,
	reminderHint,
	onRemind,
	onSendPending,
	scopeLabel,
	placement = 'overview',
}) => {
	const { awaitingAnswer } = summary;
	const prefix = scopeLabel ? `${scopeLabel}: ` : '';
	const ofScope = (count: number) => (scopeLabel ? ` ${count} de ${scopeLabel}` : '');
	const toSend = summary.stages['to-send'];
	let tone = '';
	let lead: string;
	let rest: string;
	let action: { label: string; onClick?: () => void } | null = null;
	let audienceNote = '';

	// Unsent invitations come first: a reminder only makes sense once everyone has theirs.
	if (toSend.invitations === 0 && reminderCount > 0 && awaitingAnswer.invitations > 0) {
		tone = ' guest-overview__next--remind';
		lead = `${prefix}${awaitingAnswer.invitations} ${plural(awaitingAnswer.invitations, 'invitación enviada sin confirmar', 'invitaciones enviadas sin confirmar')}`;
		rest = `${guests(awaitingAnswer.passes)}${formatSummaryParty(awaitingAnswer.passes, awaitingAnswer.children)} por confirmar.`;
		action = {
			label: scopeLabel ? `Recordar a${ofScope(reminderCount)}` : 'Recordar por WhatsApp',
			onClick: onRemind,
		};
		// The reminder audience is configurable and may include confirmed guests.
		if (reminderCount !== awaitingAnswer.invitations) {
			audienceNote = `El recordatorio llegará a ${reminderCount} ${plural(reminderCount, 'invitación', 'invitaciones')} según su configuración.`;
		}
	} else if (toSend.invitations > 0) {
		lead = `${prefix}${toSend.invitations} ${plural(toSend.invitations, 'invitación por enviar', 'invitaciones por enviar')}`;
		rest = `En total, ${guests(toSend.passes)}${formatSummaryParty(toSend.passes, toSend.children)}.`;
		action = {
			label: scopeLabel ? `Enviar${ofScope(toSend.invitations)}` : 'Enviar invitaciones',
			onClick: onSendPending,
		};
	} else if (awaitingAnswer.invitations === 0) {
		tone = ' guest-overview__next--done';
		lead = '';
		rest = scopeLabel
			? `Todas las invitaciones de ${scopeLabel} ya tienen respuesta.`
			: 'Todas las invitaciones ya tienen respuesta.';
	} else {
		return null;
	}

	return (
		<div className={`guest-overview__next${tone} guest-overview__next--${placement}`}>
			<p className="guest-overview__next-text">
				{lead && <strong>{lead}</strong>}
				{rest}
				{tone.endsWith('remind') && reminderHint && (
					<span className="guest-overview__next-hint">{reminderHint}</span>
				)}
				{audienceNote && <span className="guest-overview__next-hint">{audienceNote}</span>}
			</p>
			{action?.onClick && (
				<button
					type="button"
					className="btn-primary guest-overview__next-action"
					onClick={action.onClick}
				>
					{action.label}
				</button>
			)}
		</div>
	);
};

interface GuestSummaryShareProps {
	summary: GuestSummary;
	eventTitle: string;
	rsvpDeadline: string;
}

/** WhatsApp and copy buttons that share the event summary as text. */
const GuestSummaryShare: React.FC<GuestSummaryShareProps> = ({
	summary,
	eventTitle,
	rsvpDeadline,
}) => {
	const [shareState, setShareState] = useState<ShareState>('idle');
	const shareText = buildGuestSummaryShareText(summary, eventTitle, rsvpDeadline);
	// No phone number: WhatsApp asks the host which chat to send it to.
	const whatsAppShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
	const handleCopySummary = async () => {
		setShareState((await writeClipboardText(shareText)) ? 'copied' : 'failed');
	};

	return (
		<div className="guest-overview__share" role="group" aria-labelledby="guest-overview-share">
			<p id="guest-overview-share" className="guest-overview__share-label">
				Compartir resumen
			</p>
			<a
				className="guest-overview__share-action"
				href={whatsAppShareUrl}
				target="_blank"
				rel="noopener noreferrer"
			>
				<WhatsAppIcon size={16} />
				WhatsApp
			</a>
			<button
				type="button"
				className="guest-overview__share-action"
				onClick={() => void handleCopySummary()}
			>
				{shareState === 'copied' ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
				{shareState === 'copied' ? 'Copiado' : 'Copiar'}
			</button>
			<span className="sr-only" role="status">
				{shareState === 'copied' && 'Resumen copiado'}
			</span>
			{shareState === 'failed' && (
				<p className="guest-overview__share-status" role="alert">
					No se pudo copiar el resumen
				</p>
			)}
		</div>
	);
};

/** "Personas confirmadas": confirmed people of the assigned passes. */
const GuestPeopleHeadline: React.FC<{ people: GuestSummary['people'] }> = ({ people }) => {
	const confirmedPercent = Math.round(percentOf(people.confirmed, people.assigned));
	return (
		<>
			<h2 className="guest-overview__heading">Personas confirmadas</h2>
			<p className="guest-overview__headline">
				<span className="guest-overview__big">{people.confirmed}</span>
				<span className="guest-overview__of">
					de {passes(people.assigned)}
					{people.assigned > 0 && ` · ${confirmedPercent} %`}
				</span>
			</p>
			<GuestPartyBreakdown people={people} />
		</>
	);
};

/** Invitations still without passes, which the people totals leave out. */
const GuestWithoutPassesNote: React.FC<{ count: number }> = ({ count }) =>
	count > 0 ? (
		<p className="guest-overview__note">
			{count}{' '}
			{plural(
				count,
				'invitación no tiene pases asignados.',
				'invitaciones no tienen pases asignados.',
			)}
		</p>
	) : null;

/**
 * Event overview for every width. People (passes) answer "how many are coming";
 * invitation stages answer "what is left to do" and double as the list filter.
 * Totals always describe the whole event, never the filtered list.
 */
const GuestStatusOverview: React.FC<GuestStatusOverviewProps> = ({
	summary,
	activeFilter,
	onFilterChange,
	reminderCount = 0,
	reminderHint = null,
	hideNextStep = false,
	rsvpDeadline = '',
	eventTitle = '',
	onRemind,
	onSendPending,
	nextStepScope,
	engagement,
}) => {
	const { people, stages } = summary;

	if (summary.invitations === 0) {
		return (
			<section className="guest-overview" aria-label="Resumen de invitados">
				<div className="guest-overview__empty">
					<p className="guest-overview__empty-title">Todavía no tiene invitaciones</p>
					<p className="guest-overview__empty-detail">
						Agregue la primera invitación o importe su lista para empezar.
					</p>
				</div>
			</section>
		);
	}

	const answered = stages.confirmed.invitations + stages.declined.invitations;
	const stageButtons: StageButton[] = [
		{
			filter: 'delivery-pending',
			label: 'Por enviar',
			count: stages['to-send'].invitations,
			detail: guests(stages['to-send'].passes),
			party: formatPassBreakdown(stages['to-send'].passes, stages['to-send'].children),
		},
		{
			filter: 'unopened',
			label: 'Enviadas, sin abrir',
			count: stages.unopened.invitations,
			detail: guests(stages.unopened.passes),
			party: formatPassBreakdown(stages.unopened.passes, stages.unopened.children),
		},
		{
			filter: 'opened',
			label: 'Abiertas, sin responder',
			count: stages.opened.invitations,
			detail: guests(stages.opened.passes),
			party: formatPassBreakdown(stages.opened.passes, stages.opened.children),
		},
		{
			filter: 'answered',
			label: 'Respondidas',
			count: answered,
			detail: `${stages.confirmed.invitations} sí · ${stages.declined.invitations} no`,
		},
	];
	const toggle = (filter: GuestReviewFilterValue) =>
		onFilterChange(activeFilter === filter ? 'all' : filter);

	const slices = [
		{
			key: 'confirmed',
			label: 'Confirmadas',
			value: people.confirmed,
			children: people.confirmedChildren,
		},
		{
			key: 'declined',
			label: 'No asistirán',
			value: people.declined,
			children: people.declinedChildren,
		},
		{ key: 'unused', label: 'Lugares no usados', value: people.unused, children: 0 },
		{
			key: 'no-answer',
			label: 'Sin respuesta',
			value: people.noAnswer,
			children: people.noAnswerChildren,
		},
	];
	const barLabel = `De ${passes(people.assigned)}. ${slices
		.map(
			(slice) =>
				`${slice.label}: ${slice.value}${formatSummaryParty(slice.value, slice.children)}`,
		)
		.join(', ')}`;

	return (
		<section className="guest-overview" aria-label="Resumen de invitados">
			{!hideNextStep && (
				<GuestNextStep
					summary={nextStepScope?.summary ?? summary}
					reminderCount={nextStepScope?.reminderCount ?? reminderCount}
					scopeLabel={nextStepScope?.label}
					reminderHint={reminderHint}
					onRemind={onRemind}
					onSendPending={onSendPending}
				/>
			)}
			<div className="guest-overview__grid">
				<section
					className={`guest-overview__people${hideNextStep ? ' guest-overview__people--brief' : ''}`}
					aria-label={hideNextStep ? 'Fecha límite y resumen' : 'Personas confirmadas'}
				>
					<div className="guest-overview__people-head">
						<div className="guest-overview__hero">
							{!hideNextStep && <GuestPeopleHeadline people={people} />}
						</div>
						<div className="guest-overview__meta">
							{rsvpDeadline && (
								<p className="guest-overview__deadline">
									Confirmar antes del <strong>{rsvpDeadline}</strong>
								</p>
							)}
							<GuestSummaryShare
								summary={summary}
								eventTitle={eventTitle}
								rsvpDeadline={rsvpDeadline}
							/>
						</div>
					</div>
					{!hideNextStep && (
						<GuestPassesBar
							total={people.assigned}
							label={barLabel}
							slices={[
								{ key: 'confirmed', value: people.confirmed },
								{ key: 'declined', value: people.declined },
								{ key: 'unused', value: people.unused },
							]}
						/>
					)}
					{!hideNextStep && (
						<ul className="guest-overview__legend">
							{slices.map((slice) => (
								<li key={slice.key} className="guest-overview__legend-item">
									<span className="guest-overview__legend-label">
										<span
											className={`guest-overview__swatch guest-overview__swatch--${slice.key}`}
											aria-hidden="true"
										/>
										{slice.label}
									</span>
									<strong className="guest-overview__legend-value">
										{slice.value}
									</strong>
									{formatPassBreakdown(slice.value, slice.children) && (
										<span className="guest-overview__legend-detail">
											{formatPassBreakdown(slice.value, slice.children)}
										</span>
									)}
								</li>
							))}
						</ul>
					)}
					<GuestWithoutPassesNote count={summary.withoutPasses} />
					{!hideNextStep && (
						<details className="guest-overview__help">
							<summary>¿Qué es un pase?</summary>
							<p>
								Un pase es el lugar de una persona. Una invitación puede incluir
								varios pases. «Lugares no usados» son pases de quienes confirmaron
								menos personas de las asignadas.
							</p>
						</details>
					)}
				</section>

				<section className="guest-overview__stages" aria-labelledby="guest-overview-stages">
					<div className="guest-overview__stages-head">
						<h2 id="guest-overview-stages" className="guest-overview__heading">
							Invitaciones{' '}
							<span className="guest-overview__heading-note">
								· {answered} de {summary.invitations} respondidas (
								{Math.round(percentOf(answered, summary.invitations))} %)
							</span>
						</h2>
					</div>
					<div
						className="guest-overview__stage-grid"
						role="group"
						aria-label="Filtrar invitaciones por etapa"
					>
						{stageButtons.map((stage) => {
							const active = activeFilter === stage.filter;
							return (
								<button
									key={stage.filter}
									type="button"
									className={`guest-overview__stage${active ? ' guest-overview__stage--active' : ''}${stage.count === 0 ? ' guest-overview__stage--empty' : ''}`}
									aria-label={`${stage.label}, ${stage.count}`}
									aria-pressed={active}
									onClick={() => toggle(stage.filter)}
								>
									<span className="guest-overview__stage-label">
										{stage.label}
									</span>
									<span className="guest-overview__stage-count">
										{stage.count}
									</span>
									<span className="guest-overview__stage-detail">
										{stage.detail}
									</span>
									{stage.party && (
										<span className="guest-overview__stage-party">
											{stage.party}
										</span>
									)}
								</button>
							);
						})}
					</div>
					<GuestEngagementFunnel summary={engagement} answeredInvitations={answered} />
				</section>
			</div>
		</section>
	);
};

export default GuestStatusOverview;
