import { useEffect, useState } from 'react';
import {
	resolveMemoriesRetentionWarningDays,
	type MemoriesSpaceHostSummary,
} from '@/lib/memories/contract/catalog';
import { MEMORIES_RETENTION_WARNING_DAYS } from '@/lib/memories/contract/limits';
import { formatMemoriesDateTime } from '@/lib/memories/copy';
import {
	MEMORIES_WINDOW_BADGE,
	MEMORIES_WINDOW_LABEL,
	buildMemoriesHostStatusCopy,
	memoriesHostCopy as copy,
	memoriesMeterStep,
} from '@/lib/memories/dashboard-copy';
import { memoriesOrganizerApi } from '@/lib/memories/client/api';
import {
	memoriesCapacityLevel,
	memoriesCapacityUsedPercent,
	formatMemoriesShortDate,
	type MemoriesCapacityLevel,
} from '@/lib/memories/client/gallery';
import MemoriesQrPanel from '@/components/dashboard/memories/MemoriesQrPanel';
import MemoriesSharePanel from '@/components/dashboard/memories/MemoriesSharePanel';

const METER_MODIFIER: Record<MemoriesCapacityLevel, string> = {
	normal: 'normal',
	'near-full': 'warning',
	full: 'critical',
};

interface Props {
	eventId: string;
	/** Bumped by the catalog's refresh button to reload the totals too. */
	refreshKey: number;
}

function TimelineStep({
	label,
	iso,
	timeZone,
	modifier,
}: {
	label: string;
	iso: string;
	timeZone: string;
	modifier: 'done' | 'next' | 'later';
}) {
	return (
		<li className={`memories-host-summary__step memories-host-summary__step--${modifier}`}>
			<span>{label}</span>
			<strong>{formatMemoriesShortDate(iso, timeZone)}</strong>
		</li>
	);
}

/** Host overview: window state and dates, totals, space used and the guests' QR. */
export default function MemoriesHostSummary({ eventId, refreshKey }: Props) {
	const [summary, setSummary] = useState<MemoriesSpaceHostSummary | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [retryKey, setRetryKey] = useState(0);

	useEffect(() => {
		const controller = new AbortController();
		memoriesOrganizerApi
			.summary(eventId, controller.signal)
			.then((next) => {
				setSummary(next);
				setError(null);
			})
			.catch(() => {
				if (!controller.signal.aborted) setError(copy.loadError);
			});
		return () => controller.abort();
	}, [eventId, refreshKey, retryKey]);

	if (error) {
		return (
			<div className="memories-notice memories-notice--danger" role="alert">
				<p>{error}</p>
				<button
					type="button"
					className="btn-secondary"
					onClick={() => setRetryKey((value) => value + 1)}
				>
					{copy.retry}
				</button>
			</div>
		);
	}
	if (!summary) return null;

	const now = Date.now();
	const opened = Date.parse(summary.uploadStartsAt) <= now;
	const closed = Date.parse(summary.uploadEndsAt) <= now;
	const usedPercent = memoriesCapacityUsedPercent(summary.capacityRemainingPercent);
	const level = memoriesCapacityLevel(summary.capacityRemainingPercent);
	// Only worth an alert when there is something left to download.
	const deletionDays =
		summary.photos + summary.videos > 0
			? resolveMemoriesRetentionWarningDays(
					summary,
					new Date(),
					MEMORIES_RETENTION_WARNING_DAYS,
				)
			: null;

	return (
		<section className="memories-host-summary" aria-label={copy.eyebrow}>
			<div className="memories-host-summary__card">
				<div className="memories-host-summary__heading">
					<h2>{copy.statusTitle}</h2>
					<span
						className={`dashboard-badge ${MEMORIES_WINDOW_BADGE[summary.windowState]}`}
					>
						{MEMORIES_WINDOW_LABEL[summary.windowState]}
					</span>
				</div>
				<p>{buildMemoriesHostStatusCopy(summary)}</p>
				<ol className="memories-host-summary__timeline" aria-label={copy.timelineLabel}>
					<TimelineStep
						label={copy.opens(opened)}
						iso={summary.uploadStartsAt}
						timeZone={summary.timeZone}
						modifier={opened ? 'done' : 'next'}
					/>
					<TimelineStep
						label={copy.closes(closed)}
						iso={summary.uploadEndsAt}
						timeZone={summary.timeZone}
						modifier={closed ? 'done' : opened ? 'next' : 'later'}
					/>
					<TimelineStep
						label={copy.deletes}
						iso={summary.retentionEndsAt}
						timeZone={summary.timeZone}
						modifier={closed ? 'next' : 'later'}
					/>
				</ol>
			</div>

			{deletionDays !== null ? (
				<p className="memories-notice memories-notice--danger" role="alert">
					{copy.deletionCountdown(deletionDays)}
				</p>
			) : null}

			<div className="memories-host-summary__card">
				<dl className="memories-host-summary__stats">
					<div>
						<dt>{copy.photos}</dt>
						<dd>{summary.photos.toLocaleString('es-MX')}</dd>
					</div>
					<div>
						<dt>{copy.videos}</dt>
						<dd>{summary.videos.toLocaleString('es-MX')}</dd>
					</div>
					<div>
						<dt>{copy.guests}</dt>
						<dd>
							{summary.guestsWithUploads.toLocaleString('es-MX')}
							{summary.expectedGuests ? (
								<small> de {summary.expectedGuests.toLocaleString('es-MX')}</small>
							) : null}
						</dd>
					</div>
				</dl>
				<div className={`usage-meter usage-meter--${METER_MODIFIER[level]}`}>
					<div className="usage-meter__label">
						<span>{copy.spaceUsed}</span>
						<strong>{usedPercent} %</strong>
					</div>
					<span
						className="usage-meter__track"
						role="img"
						aria-label={copy.spaceUsedLabel(usedPercent)}
					>
						<span data-fill={memoriesMeterStep(usedPercent)} />
					</span>
					<p className="memories-host-summary__meta">
						{summary.lastAcceptedAt
							? copy.lastUpload(
									formatMemoriesDateTime(
										summary.lastAcceptedAt,
										summary.timeZone,
									),
								)
							: copy.noUploads}
					</p>
				</div>
			</div>

			{level === 'full' ? (
				<p className="memories-notice memories-notice--danger" role="status">
					{copy.full}
				</p>
			) : level === 'near-full' ? (
				<p className="memories-notice memories-notice--warning" role="status">
					{copy.nearFull(100 - usedPercent)}
				</p>
			) : null}

			{summary.windowState !== 'expired' ? (
				<MemoriesQrPanel
					eventId={eventId}
					publicUrl={summary.publicUrl}
					eventTitle={summary.eventTitle}
				/>
			) : null}

			{summary.windowState !== 'expired' ? (
				<MemoriesSharePanel eventId={eventId} initialShareUrl={summary.shareUrl} />
			) : null}
		</section>
	);
}
