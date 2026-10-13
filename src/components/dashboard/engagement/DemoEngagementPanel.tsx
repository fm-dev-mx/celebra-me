import { useEffect, useState } from 'react';
import {
	DEMO_PERIODS,
	DEMO_SORTS,
	type DemoEngagementReport,
	type DemoEngagementRow,
	type DemoPeriod,
	type DemoSort,
} from '@/interfaces/dashboard/demo-engagement.interface';
import { dashboardApi } from '@/lib/dashboard/api-client';
import {
	EVENT_TYPE_OPTIONS,
	eventTypeLabel,
	formatDate,
	formatRate,
	rankingCopy,
} from '@/lib/dashboard/engagement-ranking-copy';

export const DEMO_ENGAGEMENT_API_PATH = '/api/dashboard/admin/engagement/demos';

const copy = {
	intro: 'Retención del diseño en las demos: cuántas sesiones llegan a cada parte de la página y cuántas terminan en un contacto. Son prospectos, no invitados, por eso nunca se mezclan con las invitaciones. Las páginas cortas llegan al final con más facilidad: compare demos de extensión parecida. Datos desde el {since}.',
	period: 'Periodo',
	periodOption: (days: number) => `Últimos ${days} días`,
	sort: 'Ordenar por',
	sorts: {
		reach100: 'Llega al final',
		reach75: 'Llega al 75 %',
		contactsPer100: 'Contactos por cada 100 sesiones',
		sessions: 'Sesiones',
	} satisfies Record<DemoSort, string>,
	loading: 'Cargando demos…',
	error: 'No fue posible cargar las demos. Intente de nuevo más tarde.',
	empty: 'No hay sesiones de demos en este periodo.',
	funnel: 'Ver embudo comercial',
	retired: 'Retirada',
	insufficient: (min: number) => `Muestra insuficiente: menos de ${min} sesiones en el periodo.`,
	columns: {
		rank: '#',
		demo: 'Demo',
		type: 'Tipo',
		preset: 'Preset',
		sessions: 'Sesiones',
		reach50: 'Llega al 50 %',
		reach75: 'Llega al 75 %',
		reach100: 'Llega al final',
		bounce: 'Rebote',
		drop: 'Mayor abandono (después del 25 %)',
		contacts: 'Contactos / 100',
	},
};

function dropLabel(row: DemoEngagementRow): string {
	if (!row.largestDrop) return '—';
	const { from, to, share } = row.largestDrop;
	return `${from}–${to} % (${formatRate(share)})`;
}

function DemosTable({ report }: { report: DemoEngagementReport }) {
	const { columns } = copy;
	const showType = report.eventType === 'all';
	return (
		<div className="engagement-ranking__table-wrap">
			<table className="engagement-ranking__table">
				<caption className="sr-only">Demos</caption>
				<thead>
					<tr>
						<th scope="col">{columns.rank}</th>
						<th scope="col">{columns.demo}</th>
						{showType ? <th scope="col">{columns.type}</th> : null}
						<th scope="col">{columns.preset}</th>
						<th scope="col">{columns.sessions}</th>
						<th scope="col">{columns.bounce}</th>
						<th scope="col">{columns.reach50}</th>
						<th scope="col">{columns.reach75}</th>
						<th scope="col">{columns.reach100}</th>
						<th scope="col">{columns.drop}</th>
						<th scope="col">{columns.contacts}</th>
					</tr>
				</thead>
				<tbody>
					{report.demos.map((row) => {
						const muted = row.sampleState === 'insufficient';
						return (
							<tr
								key={row.slug}
								className={muted ? 'engagement-ranking__row--muted' : undefined}
								title={muted ? copy.insufficient(report.minSessions) : undefined}
							>
								<td>{row.rank ?? '—'}</td>
								<th scope="row">
									{row.title}
									<span className="engagement-ranking__slug">/{row.slug}</span>
									{row.listed ? null : (
										<span className="engagement-ranking__tag">
											{copy.retired}
										</span>
									)}
								</th>
								{showType ? (
									<td>{row.eventType ? eventTypeLabel(row.eventType) : '—'}</td>
								) : null}
								<td>{row.themePreset ?? '—'}</td>
								<td>{row.sessions}</td>
								<td>{formatRate(row.bounce)}</td>
								<td>{formatRate(row.reach50)}</td>
								<td>{formatRate(row.reach75)}</td>
								<td>{formatRate(row.reach100)}</td>
								<td>{dropLabel(row)}</td>
								<td>
									{row.contactsPer100 === null
										? '—'
										: `${row.contactsPer100.toLocaleString('es-MX', { maximumFractionDigits: 1 })} (${row.contactSessions})`}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

type LoadState = 'loading' | 'ready' | 'error';

export default function DemoEngagementPanel() {
	const [period, setPeriod] = useState<DemoPeriod>(30);
	const [eventType, setEventType] = useState('all');
	const [sort, setSort] = useState<DemoSort>('reach100');
	const [report, setReport] = useState<DemoEngagementReport | null>(null);
	const [state, setState] = useState<LoadState>('loading');

	useEffect(() => {
		let cancelled = false;
		setState('loading');
		const query = new URLSearchParams({ period: String(period), eventType, sort });
		void (async () => {
			const result = await dashboardApi.get<{ demos: DemoEngagementReport }>(
				`${DEMO_ENGAGEMENT_API_PATH}?${query.toString()}`,
			);
			if (cancelled) return;
			if (!result.ok) {
				setState('error');
				return;
			}
			setReport(result.data.demos);
			setState('ready');
		})();
		return () => {
			cancelled = true;
		};
	}, [period, eventType, sort]);

	return (
		<section className="engagement-ranking" aria-label="Demos">
			<p className="engagement-ranking__intro">
				{copy.intro.replace('{since}', formatDate(report?.since ?? '2026-06-29'))}
			</p>
			<div className="engagement-ranking__filters">
				<label className="engagement-ranking__filter">
					<span>{copy.period}</span>
					<select
						value={period}
						onChange={(event) => setPeriod(Number(event.target.value) as DemoPeriod)}
					>
						{DEMO_PERIODS.map((days) => (
							<option key={days} value={days}>
								{copy.periodOption(days)}
							</option>
						))}
					</select>
				</label>
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
				<label className="engagement-ranking__filter">
					<span>{copy.sort}</span>
					<select
						value={sort}
						onChange={(event) => setSort(event.target.value as DemoSort)}
					>
						{DEMO_SORTS.map((key) => (
							<option key={key} value={key}>
								{copy.sorts[key]}
							</option>
						))}
					</select>
				</label>
				<a className="engagement-ranking__link" href="/dashboard/commercial">
					{copy.funnel} →
				</a>
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
			{state === 'ready' && report ? (
				report.demos.every((row) => row.sessions === 0) ? (
					<p className="dashboard-empty-state">{copy.empty}</p>
				) : (
					<DemosTable report={report} />
				)
			) : null}
		</section>
	);
}
