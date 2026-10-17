import { useEffect, useState } from 'react';
import type { HistoricalEstimatesReport } from '@/interfaces/dashboard/engagement-ranking.interface';
import {
	EngagementRankingRequestError,
	engagementRankingApi,
} from '@/lib/dashboard/engagement-ranking-api';
import {
	EVENT_TYPE_OPTIONS,
	LEVEL_LABELS,
	eventTypeLabel,
	formatRate,
	rankingCopy,
} from '@/lib/dashboard/engagement-ranking-copy';

const copy = {
	intro: 'Estimación de lo ocurrido antes del registro de aperturas, a partir de la telemetría anterior. Son estimaciones: se muestran aparte, con rangos, y nunca se comparan con las cifras medidas ni entran al ranking.',
	method: (version: number) => `Método v${version}`,
	rules: (previewMinutes: number, gapMinutes: number, cutoff: string) => [
		`Solo cuenta lo registrado antes del ${cutoff}; desde entonces existe el registro medido.`,
		`Una vista cuenta cuando ocurre al menos ${previewMinutes} min después del primer envío; las anteriores son revisión del anfitrión o vistas previas del chat.`,
		'Un invitado cuenta como abierto si cualquiera de sus vistas cuenta, no solo la primera.',
		`Las visitas agrupan vistas separadas por menos de ${gapMinutes} min.`,
		'Las aperturas van de quienes respondieron (mínimo) a quienes vieron o respondieron (máximo). La conversión es un mínimo: el máximo sería siempre 100 %.',
		'Los invitados sin fecha de envío se cuentan aparte y no entran en los rangos.',
		'La profundidad de lectura anterior no se estima: casi siempre marcaba 100 % y no coincide con la medida.',
		'Las vistas del anfitrión después del envío no se pueden separar (≈ 6 % de las aperturas estimadas).',
	],
	loading: 'Cargando la estimación histórica…',
	error: 'No fue posible cargar la estimación histórica. Intente de nuevo más tarde.',
	unavailable: 'La estimación histórica todavía no está disponible en este entorno.',
	empty: 'No hay invitaciones con telemetría anterior al registro de aperturas.',
	columns: {
		invitation: 'Invitación',
		type: 'Tipo',
		shared: 'Enviadas',
		opened: 'Abrieron',
		visits: 'Visitas por invitado que abrió',
		conversion: 'Conversión',
		cleaned: 'Vistas descartadas (antes del envío / vista previa)',
		unshared: 'Sin fecha de envío (vieron / respondieron)',
	},
};

function Head({ label, estimated }: { label: string; estimated?: boolean }) {
	return (
		<th scope="col">
			{label}
			{estimated ? (
				<span className="engagement-ranking__level">{LEVEL_LABELS.estimated}</span>
			) : null}
		</th>
	);
}

function formatCutoff(value: string): string {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function HistoricalTable({ report }: { report: HistoricalEstimatesReport }) {
	const { columns } = copy;
	const showType = report.eventType === 'all';
	return (
		<div className="engagement-ranking__table-wrap">
			<table className="engagement-ranking__table">
				<caption className="sr-only">Histórico (estimado)</caption>
				<thead>
					<tr>
						<th scope="col">{columns.invitation}</th>
						{showType ? <th scope="col">{columns.type}</th> : null}
						<th scope="col">{columns.shared}</th>
						<Head label={columns.opened} estimated />
						<Head label={columns.visits} estimated />
						<Head label={columns.conversion} estimated />
						<th scope="col">{columns.cleaned}</th>
						<th scope="col">{columns.unshared}</th>
					</tr>
				</thead>
				<tbody>
					{report.invitations.map((row) => (
						<tr key={row.invitationId}>
							<th scope="row">
								{row.title}
								<span className="engagement-ranking__slug">/{row.slug}</span>
							</th>
							{showType ? <td>{eventTypeLabel(row.eventType)}</td> : null}
							<td>{row.guestsShared}</td>
							<td>
								{row.openedLower === row.openedUpper
									? row.openedLower
									: `${row.openedLower}–${row.openedUpper}`}
							</td>
							<td>
								{row.visitsPerViewer === null
									? '—'
									: row.visitsPerViewer.toLocaleString('es-MX', {
											maximumFractionDigits: 1,
										})}
							</td>
							<td>
								{row.conversionLower === null
									? '—'
									: `≥ ${formatRate(row.conversionLower)}`}
							</td>
							<td>
								{row.viewsBeforeShare} / {row.viewsWithinPreviewWindow}
							</td>
							<td>
								{row.guestsUnshared === 0
									? '—'
									: `${row.guestsUnshared} (${row.guestsUnsharedViewed} / ${row.guestsUnsharedRespondedSelf})`}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

export default function HistoricalEstimatesPanel() {
	const [eventType, setEventType] = useState('all');
	const [report, setReport] = useState<HistoricalEstimatesReport | null>(null);
	const [state, setState] = useState<LoadState>('loading');

	useEffect(() => {
		let cancelled = false;
		setState('loading');
		void (async () => {
			try {
				const next = await engagementRankingApi.historical(eventType);
				if (cancelled) return;
				setReport(next);
				setState('ready');
			} catch (error) {
				if (cancelled) return;
				const unavailable =
					error instanceof EngagementRankingRequestError && error.status === 503;
				setState(unavailable ? 'unavailable' : 'error');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [eventType]);

	const method = report?.method;

	return (
		<section className="engagement-ranking" aria-label="Histórico (estimado)">
			<p className="engagement-ranking__intro">{copy.intro}</p>
			<div className="engagement-ranking__filters">
				<label className="engagement-ranking__filter">
					<span>{rankingCopy.filters.eventType}</span>
					<select
						value={eventType}
						onChange={(event) => setEventType(event.target.value)}
					>
						{EVENT_TYPE_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</label>
				{method ? (
					<span className="engagement-ranking__tag">{copy.method(method.version)}</span>
				) : null}
			</div>
			{state === 'loading' ? (
				<p className="dashboard-status" role="status">
					{copy.loading}
				</p>
			) : null}
			{state === 'error' ? (
				<p className="dashboard-error" role="alert">
					{copy.error}
				</p>
			) : null}
			{state === 'unavailable' ? (
				<p className="dashboard-status" role="status">
					{copy.unavailable}
				</p>
			) : null}
			{state === 'ready' && report ? (
				report.invitations.length === 0 ? (
					<p className="dashboard-empty-state">{copy.empty}</p>
				) : (
					<HistoricalTable report={report} />
				)
			) : null}
			{method ? (
				<aside className="engagement-ranking__rules" aria-label="Reglas de la estimación">
					<ul>
						{copy
							.rules(
								method.previewWindowMinutes,
								method.visitGapMinutes,
								formatCutoff(method.cutoff),
							)
							.map((rule) => (
								<li key={rule}>{rule}</li>
							))}
					</ul>
				</aside>
			) : null}
		</section>
	);
}
