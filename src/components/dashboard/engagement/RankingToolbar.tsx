import {
	RANKING_ACTIVITY_STATES,
	RANKING_EVENT_STATUSES,
	RANKING_GROUP_KEYS,
	RANKING_METRICS,
	type RankingFacets,
	type RankingFilters,
	type RankingGroupKey,
	type RankingMetric,
} from '@/interfaces/dashboard/engagement-ranking.interface';
import type { EngagementRankingRequest } from '@/lib/dashboard/engagement-ranking-api';
import {
	ACTIVITY_LABELS,
	EVENT_STATUS_LABELS,
	EVENT_TYPE_OPTIONS,
	GROUP_KEY_LABELS,
	METRIC_LABELS,
	rankingCopy,
	valueLabel,
} from '@/lib/dashboard/engagement-ranking-copy';

interface ToolbarProps {
	request: EngagementRankingRequest;
	facets: RankingFacets | null;
	totals: { listed: number; total: number } | null;
	onChange: (next: EngagementRankingRequest) => void;
}

const { filters: copy } = rankingCopy;

function Select({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: ReadonlyArray<{ value: string; label: string }>;
	onChange: (value: string) => void;
}) {
	return (
		<label className="engagement-ranking__filter">
			<span>{label}</span>
			<select value={value} onChange={(event) => onChange(event.target.value)}>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}

const ANY = { value: '', label: copy.any };

/** Active filters as removable chips; each label names its filter. */
function activeChips(filters: RankingFilters) {
	const chips: Array<{ key: keyof RankingFilters; label: string }> = [];
	if (filters.eventStatus)
		chips.push({ key: 'eventStatus', label: EVENT_STATUS_LABELS[filters.eventStatus] });
	if (filters.activity) chips.push({ key: 'activity', label: ACTIVITY_LABELS[filters.activity] });
	if (filters.fontFamily)
		chips.push({ key: 'fontFamily', label: `${copy.fontFamily}: ${filters.fontFamily}` });
	if (filters.music)
		chips.push({
			key: 'music',
			label: filters.music === 'with' ? copy.musicWith : copy.musicWithout,
		});
	if (filters.confirmationMode)
		chips.push({
			key: 'confirmationMode',
			label: `${copy.confirmationMode}: ${valueLabel('confirmationMode', filters.confirmationMode)}`,
		});
	if (filters.includeDisabled)
		chips.push({ key: 'includeDisabled', label: copy.includeDisabled });
	return chips;
}

function FilterPanel({
	filters,
	facets,
	onChange,
}: {
	filters: RankingFilters;
	facets: RankingFacets | null;
	onChange: (next: RankingFilters) => void;
}) {
	const set = (patch: Partial<RankingFilters>) => onChange({ ...filters, ...patch });
	const facetOptions = (key: 'fontFamily' | 'confirmationMode') => [
		ANY,
		...(facets?.[key] ?? []).map((item) => ({
			value: item.value,
			label: `${valueLabel(key, item.value)} (${item.count})`,
		})),
	];
	return (
		<div className="engagement-ranking__filter-panel">
			<Select
				label={copy.eventStatus}
				value={filters.eventStatus ?? ''}
				options={[
					ANY,
					...RANKING_EVENT_STATUSES.map((value) => ({
						value,
						label: EVENT_STATUS_LABELS[value],
					})),
				]}
				onChange={(value) =>
					set({ eventStatus: (value || undefined) as RankingFilters['eventStatus'] })
				}
			/>
			<Select
				label={copy.activity}
				value={filters.activity ?? ''}
				options={[
					ANY,
					...RANKING_ACTIVITY_STATES.map((value) => ({
						value,
						label: ACTIVITY_LABELS[value],
					})),
				]}
				onChange={(value) =>
					set({ activity: (value || undefined) as RankingFilters['activity'] })
				}
			/>
			<Select
				label={copy.fontFamily}
				value={filters.fontFamily ?? ''}
				options={facetOptions('fontFamily')}
				onChange={(value) => set({ fontFamily: value || undefined })}
			/>
			<Select
				label={copy.music}
				value={filters.music ?? ''}
				options={[
					ANY,
					{ value: 'with', label: copy.musicWith },
					{ value: 'without', label: copy.musicWithout },
				]}
				onChange={(value) =>
					set({ music: (value || undefined) as RankingFilters['music'] })
				}
			/>
			<Select
				label={copy.confirmationMode}
				value={filters.confirmationMode ?? ''}
				options={facetOptions('confirmationMode')}
				onChange={(value) =>
					set({
						confirmationMode: (value ||
							undefined) as RankingFilters['confirmationMode'],
					})
				}
			/>
			<label className="engagement-ranking__check">
				<input
					type="checkbox"
					checked={Boolean(filters.includeDisabled)}
					onChange={(event) =>
						set({ includeDisabled: event.target.checked || undefined })
					}
				/>
				<span>{copy.includeDisabled}</span>
			</label>
		</div>
	);
}

export default function RankingToolbar({ request, facets, totals, onChange }: ToolbarProps) {
	const chips = activeChips(request.filters);
	const setFilters = (filters: RankingFilters) => onChange({ ...request, filters });
	return (
		<div className="engagement-ranking__toolbar">
			<div className="engagement-ranking__filters">
				<Select
					label={copy.eventType}
					value={request.eventType}
					options={EVENT_TYPE_OPTIONS}
					onChange={(eventType) => onChange({ ...request, eventType })}
				/>
				<Select
					label={copy.groupBy}
					value={request.groupBy}
					options={RANKING_GROUP_KEYS.map((key) => ({
						value: key,
						label: GROUP_KEY_LABELS[key],
					}))}
					onChange={(groupBy) =>
						onChange({ ...request, groupBy: groupBy as RankingGroupKey })
					}
				/>
				<Select
					label={copy.metric}
					value={request.metric}
					options={RANKING_METRICS.map((key) => ({
						value: key,
						label: METRIC_LABELS[key],
					}))}
					onChange={(metric) => onChange({ ...request, metric: metric as RankingMetric })}
				/>
				<details className="engagement-ranking__more">
					<summary>
						{copy.open}
						{chips.length > 0 ? ` (${chips.length})` : ''}
					</summary>
					<FilterPanel filters={request.filters} facets={facets} onChange={setFilters} />
				</details>
			</div>
			<div className="engagement-ranking__chips" aria-live="polite">
				{chips.map((chip) => (
					<button
						key={chip.key}
						type="button"
						className="engagement-ranking__chip"
						aria-label={`${copy.remove}: ${chip.label}`}
						onClick={() => setFilters({ ...request.filters, [chip.key]: undefined })}
					>
						{chip.label} <span aria-hidden="true">✕</span>
					</button>
				))}
				{chips.length > 0 ? (
					<button
						type="button"
						className="engagement-ranking__clear"
						onClick={() => setFilters({})}
					>
						{copy.clear}
					</button>
				) : null}
				{totals ? (
					<span className="engagement-ranking__count">
						{copy.showing(totals.listed, totals.total)}
					</span>
				) : null}
			</div>
		</div>
	);
}
