import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import {
	RANKING_GROUP_KEYS,
	RANKING_METRICS,
	type EngagementRankingReport,
	type RankingDesignGroup,
	type RankingGroupKey,
	type RankingInvitation,
	type RankingMetric,
} from '@/interfaces/dashboard/engagement-ranking.interface';
import {
	engagementRankingApi,
	EngagementRankingRequestError,
} from '@/lib/dashboard/engagement-ranking-api';
import {
	EVENT_TYPE_OPTIONS,
	GROUP_KEY_LABELS,
	METRIC_LABELS,
	formatDate,
	formatDays,
	formatDurationSeconds,
	formatRate,
	formatRatio,
	rankingCopy,
} from '@/lib/dashboard/engagement-ranking-copy';

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

interface Filters {
	eventType: string;
	groupBy: RankingGroupKey;
	metric: RankingMetric;
}

const DEFAULT_FILTERS: Filters = {
	eventType: EVENT_TYPE_OPTIONS[0]?.value ?? 'xv',
	groupBy: 'themePreset',
	metric: 'rsvpConversion',
};

function groupLabel(value: string | null): string {
	return value ?? rankingCopy.noDesign;
}

function RankingFilters({
	filters,
	onChange,
}: {
	filters: Filters;
	onChange: (next: Filters) => void;
}) {
	return (
		<form className="engagement-ranking__filters" onSubmit={(event) => event.preventDefault()}>
			<label className="engagement-ranking__filter">
				<span>{rankingCopy.filters.eventType}</span>
				<select
					value={filters.eventType}
					onChange={(event) => onChange({ ...filters, eventType: event.target.value })}
				>
					{EVENT_TYPE_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</label>
			<label className="engagement-ranking__filter">
				<span>{rankingCopy.filters.groupBy}</span>
				<select
					value={filters.groupBy}
					onChange={(event) =>
						onChange({ ...filters, groupBy: event.target.value as RankingGroupKey })
					}
				>
					{RANKING_GROUP_KEYS.map((key) => (
						<option key={key} value={key}>
							{GROUP_KEY_LABELS[key]}
						</option>
					))}
				</select>
			</label>
			<label className="engagement-ranking__filter">
				<span>{rankingCopy.filters.metric}</span>
				<select
					value={filters.metric}
					onChange={(event) =>
						onChange({ ...filters, metric: event.target.value as RankingMetric })
					}
				>
					{RANKING_METRICS.map((metric) => (
						<option key={metric} value={metric}>
							{METRIC_LABELS[metric]}
						</option>
					))}
				</select>
			</label>
		</form>
	);
}

function DesignsTable({ report }: { report: EngagementRankingReport }) {
	const { columns } = rankingCopy;
	const tooSmall = rankingCopy.groupTooSmall(report.thresholds);
	return (
		<div className="engagement-ranking__table-wrap">
			<table className="engagement-ranking__table">
				<caption className="sr-only">{rankingCopy.designsTitle}</caption>
				<thead>
					<tr>
						<th scope="col">{columns.rank}</th>
						<th scope="col">{columns.group}</th>
						<th scope="col">{columns.invitations}</th>
						<th scope="col">{columns.eligible}</th>
						<th scope="col">{columns.openRate}</th>
						<th scope="col">{columns.completionRate}</th>
						<th scope="col">{columns.rsvpConversion}</th>
						<th scope="col">{columns.timeToRespond}</th>
						<th scope="col">{columns.shareLeadDays}</th>
						<th scope="col">{columns.reminderCoverage}</th>
					</tr>
				</thead>
				<tbody>
					{report.designs.map((group: RankingDesignGroup) => (
						<tr
							key={group.groupValue ?? '__none__'}
							className={
								group.rank === null ? 'engagement-ranking__row--muted' : undefined
							}
							title={group.rank === null ? tooSmall : undefined}
						>
							<td>{group.rank ?? '—'}</td>
							<th scope="row">{groupLabel(group.groupValue)}</th>
							<td>{group.invitations}</td>
							<td>{group.eligibleInvitations}</td>
							<td>{formatRate(group.openRate)}</td>
							<td>{formatRate(group.completionRate)}</td>
							<td>{formatRate(group.rsvpConversion)}</td>
							<td>{formatDurationSeconds(group.medianSecondsToRespond)}</td>
							<td>{formatDays(group.shareLeadDays)}</td>
							<td>{formatRate(group.reminderCoverage)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function InvitationsTable({ report }: { report: EngagementRankingReport }) {
	const { columns } = rankingCopy;
	const insufficient = rankingCopy.insufficient(report.thresholds);
	return (
		<div className="engagement-ranking__table-wrap">
			<table className="engagement-ranking__table">
				<caption className="sr-only">{rankingCopy.invitationsTitle}</caption>
				<thead>
					<tr>
						<th scope="col">{columns.rank}</th>
						<th scope="col">{columns.invitation}</th>
						<th scope="col">{columns.group}</th>
						<th scope="col">{columns.eventDate}</th>
						<th scope="col">{columns.snapshot}</th>
						<th scope="col">{columns.shared}</th>
						<th scope="col">{columns.opened}</th>
						<th scope="col">{columns.responded}</th>
						<th scope="col">{columns.openRate}</th>
						<th scope="col">{columns.completionRate}</th>
						<th scope="col">{columns.rsvpConversion}</th>
						<th scope="col">{columns.reopenRatio}</th>
						<th scope="col">{columns.timeToRespond}</th>
						<th scope="col">{columns.mobileShare}</th>
						<th scope="col">{columns.shareLeadDays}</th>
						<th scope="col">{columns.reminderCoverage}</th>
					</tr>
				</thead>
				<tbody>
					{report.invitations.map((item: RankingInvitation, index) => {
						const muted = item.sampleState === 'insufficient';
						return (
							<tr
								key={item.eventId ?? `deleted-${index}`}
								className={muted ? 'engagement-ranking__row--muted' : undefined}
								title={muted ? insufficient : undefined}
							>
								<td>{item.rank ?? '—'}</td>
								<th scope="row">
									{item.eventDeleted || !item.title ? (
										<span className="engagement-ranking__deleted">
											{rankingCopy.deletedEvent}
										</span>
									) : (
										<>
											{item.title}
											{item.slug ? (
												<span className="engagement-ranking__slug">
													/{item.slug}
												</span>
											) : null}
										</>
									)}
								</th>
								<td>{groupLabel(item.groupValue)}</td>
								<td>{formatDate(item.eventDate)}</td>
								<td>{rankingCopy.snapshotKind[item.snapshotKind]}</td>
								<td>{item.guestsShared}</td>
								<td>{item.guestsOpened}</td>
								<td>{item.guestsResponded}</td>
								<td>{formatRate(item.openRate)}</td>
								<td>{formatRate(item.completionRate)}</td>
								<td>{formatRate(item.rsvpConversion)}</td>
								<td>{formatRatio(item.reopenRatio)}</td>
								<td>{formatDurationSeconds(item.medianSecondsToRespond)}</td>
								<td>{formatRate(item.mobileShare)}</td>
								<td>{formatDays(item.shareLeadDays)}</td>
								<td>{formatRate(item.reminderCoverage)}</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function RankingContent() {
	const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
	const [report, setReport] = useState<EngagementRankingReport | null>(null);
	const [state, setState] = useState<LoadState>('loading');

	useEffect(() => {
		let cancelled = false;
		setState('loading');
		void (async () => {
			try {
				const next = await engagementRankingApi.ranking(filters);
				if (cancelled) return;
				setReport(next);
				setState('ready');
			} catch (error) {
				if (cancelled) return;
				// The routine may not exist yet in this environment (additive migration pending).
				const unavailable =
					error instanceof EngagementRankingRequestError && error.status === 503;
				setState(unavailable ? 'unavailable' : 'error');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [filters]);

	const since = report?.since ?? '2026-10-12';
	const thresholds = report?.thresholds ?? { sharedGuests: 20, groupInvitations: 5 };

	return (
		<section className="engagement-ranking" aria-label={rankingCopy.title}>
			<p className="engagement-ranking__intro">
				{rankingCopy.intro.replace('{since}', formatDate(since))}
			</p>
			<RankingFilters filters={filters} onChange={setFilters} />
			{state === 'loading' ? (
				<p className="dashboard-status" role="status">
					{rankingCopy.loading}
				</p>
			) : null}
			{state === 'error' ? (
				<p className="dashboard-error" role="alert">
					{rankingCopy.error}
				</p>
			) : null}
			{state === 'unavailable' ? (
				<p className="dashboard-status" role="status">
					{rankingCopy.unavailable}
				</p>
			) : null}
			{state === 'ready' && report ? (
				report.invitations.length === 0 ? (
					<p className="dashboard-empty-state">{rankingCopy.empty}</p>
				) : (
					<>
						<section className="engagement-ranking__section">
							<h2 className="engagement-ranking__section-title">
								{rankingCopy.designsTitle}
							</h2>
							<DesignsTable report={report} />
						</section>
						<section className="engagement-ranking__section">
							<h2 className="engagement-ranking__section-title">
								{rankingCopy.invitationsTitle}
							</h2>
							<InvitationsTable report={report} />
						</section>
					</>
				)
			) : null}
			<aside className="engagement-ranking__rules" aria-label="Reglas de comparación">
				<ul>
					{rankingCopy.rules(thresholds).map((rule) => (
						<li key={rule}>{rule}</li>
					))}
				</ul>
			</aside>
		</section>
	);
}

export default function EngagementRankingPanel() {
	return (
		<ErrorBoundary>
			<RankingContent />
		</ErrorBoundary>
	);
}
