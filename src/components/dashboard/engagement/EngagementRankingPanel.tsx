import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/dashboard/ErrorBoundary';
import DemoEngagementPanel from '@/components/dashboard/engagement/DemoEngagementPanel';
import HistoricalEstimatesPanel from '@/components/dashboard/engagement/HistoricalEstimatesPanel';
import RankingToolbar from '@/components/dashboard/engagement/RankingToolbar';
import { DesignsTable, InvitationsTable } from '@/components/dashboard/engagement/RankingTables';
import type { EngagementRankingReport } from '@/interfaces/dashboard/engagement-ranking.interface';
import {
	DEFAULT_RANKING_REQUEST,
	EngagementRankingRequestError,
	engagementRankingApi,
	fromRankingSearch,
	toRankingSearch,
	type EngagementRankingRequest,
} from '@/lib/dashboard/engagement-ranking-api';
import { formatDate, rankingCopy } from '@/lib/dashboard/engagement-ranking-copy';

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';

const DEFAULT_SINCE = '2026-10-12';
const DEFAULT_THRESHOLDS = { sharedGuests: 20, groupInvitations: 5 };

function initialRequest(): EngagementRankingRequest {
	if (typeof window === 'undefined') return DEFAULT_RANKING_REQUEST;
	return fromRankingSearch(window.location.search);
}

/** Keeps the page URL in step with the view so it can be shared and restored. */
function syncUrl(request: EngagementRankingRequest): void {
	if (typeof window === 'undefined') return;
	const search = toRankingSearch(request);
	const next = `${window.location.pathname}${search ? `?${search}` : ''}`;
	if (next !== `${window.location.pathname}${window.location.search}`) {
		window.history.replaceState(null, '', next);
	}
}

function RankingContent() {
	const [request, setRequest] = useState<EngagementRankingRequest>(initialRequest);
	const [report, setReport] = useState<EngagementRankingReport | null>(null);
	const [state, setState] = useState<LoadState>('loading');

	useEffect(() => {
		syncUrl(request);
		let cancelled = false;
		setState('loading');
		void (async () => {
			try {
				const next = await engagementRankingApi.ranking(request);
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
	}, [request]);

	const since = formatDate(report?.since ?? DEFAULT_SINCE);
	const thresholds = report?.thresholds ?? DEFAULT_THRESHOLDS;

	return (
		<section className="engagement-ranking" aria-label={rankingCopy.title}>
			<p className="engagement-ranking__intro">
				{rankingCopy.intro.replace('{since}', since)}
			</p>
			<RankingToolbar
				request={request}
				facets={report?.facets ?? null}
				totals={state === 'ready' ? (report?.totals ?? null) : null}
				onChange={setRequest}
			/>
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

type RankingTab = 'invitations' | 'historical' | 'demos';

const TABS: ReadonlyArray<{ id: RankingTab; label: string }> = [
	{ id: 'invitations', label: rankingCopy.invitationsTitle },
	{ id: 'historical', label: 'Histórico (estimado)' },
	{ id: 'demos', label: 'Demos' },
];

function initialTab(): RankingTab {
	if (typeof window === 'undefined') return 'invitations';
	const tab = new URLSearchParams(window.location.search).get('tab');
	return TABS.find((item) => item.id === tab)?.id ?? 'invitations';
}

export default function EngagementRankingPanel() {
	const [tab, setTab] = useState<RankingTab>(initialTab);
	const select = (next: RankingTab) => {
		setTab(next);
		if (typeof window !== 'undefined') {
			window.history.replaceState(
				null,
				'',
				next === 'invitations'
					? window.location.pathname
					: `${window.location.pathname}?tab=${next}`,
			);
		}
	};
	return (
		<ErrorBoundary>
			<div className="engagement-ranking__tabs" role="tablist" aria-label={rankingCopy.title}>
				{TABS.map((item) => (
					<button
						key={item.id}
						type="button"
						role="tab"
						id={`ranking-tab-${item.id}`}
						aria-selected={tab === item.id}
						aria-controls={`ranking-panel-${item.id}`}
						className="engagement-ranking__tab"
						onClick={() => select(item.id)}
					>
						{item.label}
					</button>
				))}
			</div>
			<div role="tabpanel" id={`ranking-panel-${tab}`} aria-labelledby={`ranking-tab-${tab}`}>
				{tab === 'demos' ? <DemoEngagementPanel /> : null}
				{tab === 'historical' ? <HistoricalEstimatesPanel /> : null}
				{tab === 'invitations' ? <RankingContent /> : null}
			</div>
		</ErrorBoundary>
	);
}
