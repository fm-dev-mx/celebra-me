import React, { useState } from 'react';
import GuestPassesBar from '@/components/dashboard/guests/GuestPassesBar';
import { writeClipboardText } from '@/hooks/use-clipboard';
import {
	buildGuestSummaryShareText,
	type GuestReviewFilterValue,
	type GuestSummary,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestStatusOverviewProps {
	summary: GuestSummary;
	activeFilter: GuestReviewFilterValue;
	onFilterChange: (filter: GuestReviewFilterValue) => void;
	/** Guests eligible for a reminder right now; shows the reminder step when above zero. */
	reminderCount?: number;
	/** Context for the reminder step, e.g. days left before the event. */
	reminderHint?: string | null;
	/** Guests who left a message; adds the "Con mensaje" shortcut when above zero. */
	withMessageCount?: number;
	/** Formatted RSVP deadline; empty when the event has none. */
	rsvpDeadline?: string;
	eventTitle?: string;
	onRemind?: () => void;
	onSendPending?: () => void;
	/** Active group filter: the next step then speaks for that group only. */
	nextStepScope?: { label: string; summary: GuestSummary; reminderCount: number };
}

interface StageButton {
	filter: GuestReviewFilterValue;
	label: string;
	count: number;
	detail: string;
}

function plural(count: number, singular: string, pluralForm: string): string {
	return count === 1 ? singular : pluralForm;
}

function passes(count: number): string {
	return `${count} ${plural(count, 'pase', 'pases')}`;
}

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
}

/** The one thing worth doing next: remind the unanswered, send the unsent, or nothing. */
const GuestNextStep: React.FC<GuestNextStepProps> = ({
	summary,
	reminderCount,
	reminderHint,
	onRemind,
	onSendPending,
	scopeLabel,
}) => {
	const { awaitingAnswer } = summary;
	const prefix = scopeLabel ? `${scopeLabel}: ` : '';
	const ofScope = (count: number) => (scopeLabel ? ` ${count} de ${scopeLabel}` : '');
	const toSend = summary.stages['to-send'];
	let tone = '';
	let lead: string;
	let rest: string;
	let action: { label: string; onClick?: () => void } | null = null;

	if (reminderCount > 0 && awaitingAnswer.invitations > 0) {
		tone = ' guest-overview__next--remind';
		lead = `${prefix}${awaitingAnswer.invitations} ${plural(awaitingAnswer.invitations, 'invitación enviada sigue', 'invitaciones enviadas siguen')}`;
		rest = ` sin respuesta (${passes(awaitingAnswer.passes)}).`;
		action = {
			label: scopeLabel ? `Recordar a${ofScope(reminderCount)}` : 'Recordar por WhatsApp',
			onClick: onRemind,
		};
	} else if (toSend.invitations > 0) {
		lead = `${prefix}${toSend.invitations} ${plural(toSend.invitations, 'invitación por enviar', 'invitaciones por enviar')}`;
		rest = ` (${passes(toSend.passes)}).`;
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
		<div className={`guest-overview__next${tone}`}>
			<p className="guest-overview__next-text">
				{lead && <strong>{lead}</strong>}
				{rest}
				{tone.endsWith('remind') && reminderHint && (
					<span className="guest-overview__next-hint">{reminderHint}</span>
				)}
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
	withMessageCount = 0,
	rsvpDeadline = '',
	eventTitle = '',
	onRemind,
	onSendPending,
	nextStepScope,
}) => {
	const [shareState, setShareState] = useState<ShareState>('idle');
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

	const confirmedPercent = Math.round(percentOf(people.confirmed, people.assigned));
	const answered = stages.confirmed.invitations + stages.declined.invitations;
	const stageButtons: StageButton[] = [
		{
			filter: 'delivery-pending',
			label: 'Por enviar',
			count: stages['to-send'].invitations,
			detail: passes(stages['to-send'].passes),
		},
		{
			filter: 'unopened',
			label: 'Enviadas, sin abrir',
			count: stages.unopened.invitations,
			detail: passes(stages.unopened.passes),
		},
		{
			filter: 'opened',
			label: 'Abiertas, sin responder',
			count: stages.opened.invitations,
			detail: passes(stages.opened.passes),
		},
		{
			filter: 'answered',
			label: 'Respondidas',
			count: answered,
			detail: `${stages.confirmed.invitations} sí · ${stages.declined.invitations} no`,
		},
	];
	const shortcuts: StageButton[] = [];
	if (reminderCount > 0) {
		shortcuts.push({
			filter: 'reminder-pending',
			label: 'Por recordar',
			count: reminderCount,
			detail: '',
		});
	}
	if (withMessageCount > 0) {
		shortcuts.push({
			filter: 'with-message',
			label: 'Con mensaje',
			count: withMessageCount,
			detail: '',
		});
	}

	const toggle = (filter: GuestReviewFilterValue) =>
		onFilterChange(activeFilter === filter ? 'all' : filter);

	const handleShareSummary = async () => {
		const text = buildGuestSummaryShareText(summary, eventTitle, rsvpDeadline);
		if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
			try {
				await navigator.share({ text });
				return;
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
			}
		}
		setShareState((await writeClipboardText(text)) ? 'copied' : 'failed');
	};

	const slices = [
		{ key: 'confirmed', label: 'Confirmadas', value: people.confirmed },
		{ key: 'declined', label: 'No asistirán', value: people.declined },
		{ key: 'unused', label: 'Lugares no usados', value: people.unused },
		{ key: 'no-answer', label: 'Sin respuesta', value: people.noAnswer },
	];
	const barLabel = `De ${passes(people.assigned)}. ${slices
		.map((slice) => `${slice.label}: ${slice.value}`)
		.join(', ')}`;

	return (
		<section className="guest-overview" aria-label="Resumen de invitados">
			<div className="guest-overview__grid">
				<section className="guest-overview__people" aria-labelledby="guest-overview-people">
					<h2 id="guest-overview-people" className="guest-overview__heading">
						Personas confirmadas
					</h2>
					<p className="guest-overview__headline">
						<span className="guest-overview__big">{people.confirmed}</span>
						<span className="guest-overview__of">
							de {passes(people.assigned)}
							{people.assigned > 0 && ` · ${confirmedPercent} %`}
						</span>
					</p>
					<GuestPassesBar
						total={people.assigned}
						label={barLabel}
						slices={[
							{ key: 'confirmed', value: people.confirmed },
							{ key: 'declined', value: people.declined },
							{ key: 'unused', value: people.unused },
						]}
					/>
					<ul className="guest-overview__legend">
						{slices.map((slice) => (
							<li key={slice.key} className="guest-overview__legend-item">
								<span
									className={`guest-overview__swatch guest-overview__swatch--${slice.key}`}
									aria-hidden="true"
								/>
								<span className="guest-overview__legend-label">{slice.label}</span>
								<strong className="guest-overview__legend-value">
									{slice.value}
								</strong>
							</li>
						))}
					</ul>
					<details className="guest-overview__help">
						<summary>¿Qué es un pase?</summary>
						<p>
							Un pase es el lugar de una persona. Una invitación puede incluir varios
							pases. «Lugares no usados» son pases de quienes confirmaron menos
							personas de las asignadas.
						</p>
					</details>
					{summary.withoutPasses > 0 && (
						<p className="guest-overview__note">
							{summary.withoutPasses}{' '}
							{plural(
								summary.withoutPasses,
								'invitación no tiene pases asignados.',
								'invitaciones no tienen pases asignados.',
							)}
						</p>
					)}
					<div className="guest-overview__meta">
						{rsvpDeadline && (
							<p className="guest-overview__deadline">
								Confirmar antes del <strong>{rsvpDeadline}</strong>
							</p>
						)}
						<button
							type="button"
							className="guest-overview__link"
							onClick={() => void handleShareSummary()}
						>
							Compartir resumen
						</button>
						<span className="guest-overview__share-status" role="status">
							{shareState === 'copied' && 'Resumen copiado'}
							{shareState === 'failed' && 'No se pudo copiar el resumen'}
						</span>
					</div>
				</section>

				<section className="guest-overview__stages" aria-labelledby="guest-overview-stages">
					<h2 id="guest-overview-stages" className="guest-overview__heading">
						Invitaciones{' '}
						<span className="guest-overview__heading-note">
							· {summary.invitations} en total
						</span>
					</h2>
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
									className={`guest-overview__stage${active ? ' guest-overview__stage--active' : ''}`}
									aria-label={`${stage.label}, ${stage.count}`}
									aria-pressed={active}
									onClick={() => toggle(stage.filter)}
								>
									<span className="guest-overview__stage-count">
										{stage.count}
									</span>
									<span className="guest-overview__stage-label">
										{stage.label}
									</span>
									<span className="guest-overview__stage-detail">
										{stage.detail}
									</span>
								</button>
							);
						})}
					</div>
					{shortcuts.length > 0 && (
						<div
							className="guest-overview__shortcuts"
							role="group"
							aria-label="Otros filtros"
						>
							{shortcuts.map((shortcut) => {
								const active = activeFilter === shortcut.filter;
								return (
									<button
										key={shortcut.filter}
										type="button"
										className={`guest-overview__chip${active ? ' guest-overview__chip--active' : ''}`}
										aria-label={`${shortcut.label}, ${shortcut.count}`}
										aria-pressed={active}
										onClick={() => toggle(shortcut.filter)}
									>
										{shortcut.label}
										<span className="guest-overview__chip-count">
											{shortcut.count}
										</span>
									</button>
								);
							})}
						</div>
					)}
					<GuestNextStep
						summary={nextStepScope?.summary ?? summary}
						reminderCount={nextStepScope?.reminderCount ?? reminderCount}
						scopeLabel={nextStepScope?.label}
						reminderHint={reminderHint}
						onRemind={onRemind}
						onSendPending={onSendPending}
					/>
				</section>
			</div>
		</section>
	);
};

export default GuestStatusOverview;
