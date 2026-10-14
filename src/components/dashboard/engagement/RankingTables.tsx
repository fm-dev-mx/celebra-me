import type {
	EngagementRankingReport,
	RankingDesignGroup,
	RankingInvitation,
} from '@/interfaces/dashboard/engagement-ranking.interface';
import {
	LEVEL_LABELS,
	eventTypeLabel,
	formatDate,
	formatDays,
	formatDurationSeconds,
	formatRate,
	formatUpperBound,
	rankingCopy,
	valueLabel,
	type LevelKey,
} from '@/lib/dashboard/engagement-ranking-copy';

const { columns } = rankingCopy;

/** Column header with its confidence level, so every figure states how it was obtained. */
function Head({ label, level }: { label: string; level?: LevelKey }) {
	return (
		<th scope="col">
			{label}
			{level ? (
				<span className={`engagement-ranking__level engagement-ranking__level--${level}`}>
					{LEVEL_LABELS[level]}
				</span>
			) : null}
		</th>
	);
}

export function DesignsTable({ report }: { report: EngagementRankingReport }) {
	const showType = report.eventType === 'all';
	const tooSmall = rankingCopy.groupTooSmall(report.thresholds);
	return (
		<div className="engagement-ranking__table-wrap">
			<table className="engagement-ranking__table">
				<caption className="sr-only">{rankingCopy.designsTitle}</caption>
				<thead>
					<tr>
						<Head label={columns.rank} />
						{showType ? <Head label={columns.type} /> : null}
						<Head label={columns.group} />
						<Head label={columns.invitations} />
						<Head label={columns.comparable} />
						<Head label={columns.responseRate} level="exact" />
						<Head label={columns.openRate} level="measured" />
						<Head label={columns.completionRate} level="measured" />
						<Head label={columns.conversion} level="bound" />
						<Head label={columns.timeToRespond} level="measured" />
						<Head label={columns.shareLeadDays} level="exact" />
						<Head label={columns.reminderCoverage} level="exact" />
					</tr>
				</thead>
				<tbody>
					{report.designs.map((group: RankingDesignGroup) => (
						<tr
							key={`${group.eventType}-${group.groupValue ?? '__none__'}`}
							className={
								group.rank === null ? 'engagement-ranking__row--muted' : undefined
							}
							title={group.rank === null ? tooSmall : undefined}
						>
							<td>{group.rank ?? '—'}</td>
							{showType ? <td>{eventTypeLabel(group.eventType)}</td> : null}
							<th scope="row">{valueLabel(report.groupKey, group.groupValue)}</th>
							<td>{group.invitations}</td>
							<td>{group.comparableInvitations}</td>
							<td>{formatRate(group.responseRate)}</td>
							<td>{formatRate(group.openRate)}</td>
							<td>{formatRate(group.completionRate)}</td>
							<td>{formatUpperBound(group.conversionUpper)}</td>
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

function conversionCell(item: RankingInvitation): string {
	if (item.conversionMeasurability === 'none') return rankingCopy.conversionNone;
	const value = formatUpperBound(item.conversionUpper);
	return item.conversionMeasurability === 'partial'
		? `${value} · ${rankingCopy.conversionPartial}`
		: value;
}

function rowNote(item: RankingInvitation, report: EngagementRankingReport): string | undefined {
	if (item.publicAccess === 'disabled') return rankingCopy.disabled;
	if (item.sampleState === 'insufficient') return rankingCopy.insufficient(report.thresholds);
	return undefined;
}

export function InvitationsTable({ report }: { report: EngagementRankingReport }) {
	const showType = report.eventType === 'all';
	const since = formatDate(report.since);
	return (
		<div className="engagement-ranking__table-wrap">
			<table className="engagement-ranking__table">
				<caption className="sr-only">{rankingCopy.invitationsTitle}</caption>
				<thead>
					<tr>
						<Head label={columns.rank} />
						<Head label={columns.invitation} />
						{showType ? <Head label={columns.type} /> : null}
						<Head label={columns.group} />
						<Head label={columns.eventDate} />
						<Head label={columns.shared} level="exact" />
						<Head label={columns.responded} level="exact" />
						<Head label={columns.respondedSelf} level="exact" />
						<Head label={columns.responseRate} level="exact" />
						<Head label={columns.opened} level="measured" />
						<Head label={columns.openedInferred} level="inferred" />
						<Head label={columns.conversion} level="bound" />
						<Head label={columns.openRate} level="measured" />
						<Head label={columns.completionRate} level="measured" />
						<Head label={columns.timeToRespond} level="measured" />
						<Head label={columns.shareLeadDays} level="exact" />
						<Head label={columns.reminderCoverage} level="exact" />
					</tr>
				</thead>
				<tbody>
					{report.invitations.map((item: RankingInvitation) => {
						const note = rowNote(item, report);
						const muted =
							item.rank === null &&
							(note !== undefined || item.activityState === 'none');
						return (
							<tr
								key={item.invitationId}
								className={muted ? 'engagement-ranking__row--muted' : undefined}
								title={note}
							>
								<td>{item.rank ?? '—'}</td>
								<th scope="row">
									{item.title}
									<span className="engagement-ranking__slug">/{item.slug}</span>
									{item.publicAccess === 'disabled' ? (
										<span className="engagement-ranking__tag">
											{rankingCopy.disabled}
										</span>
									) : null}
									{item.activityState === 'none' ? (
										<span className="engagement-ranking__tag">
											{rankingCopy.noActivity(since)}
										</span>
									) : null}
								</th>
								{showType ? <td>{eventTypeLabel(item.eventType)}</td> : null}
								<td>{valueLabel(report.groupKey, item.groupValue)}</td>
								<td>{formatDate(item.eventDate)}</td>
								<td>{item.guestsShared}</td>
								<td>{item.guestsResponded}</td>
								<td>{item.guestsRespondedSelf}</td>
								<td>{formatRate(item.responseRate)}</td>
								<td>{item.activityState === 'none' ? '—' : item.guestsOpened}</td>
								<td>{item.guestsOpenedInferred}</td>
								<td>{conversionCell(item)}</td>
								<td>{formatRate(item.openRate)}</td>
								<td>{formatRate(item.completionRate)}</td>
								<td>{formatDurationSeconds(item.medianSecondsToRespond)}</td>
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
