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
} from '@/lib/memories/dashboard-copy';
import { memoriesOrganizerApi } from '@/lib/memories/client/api';

interface Props {
	eventId: string;
	/** Bumped by the catalog's refresh button to reload the totals too. */
	refreshKey: number;
}

/** Host progress strip: state, totals, remaining space and the shareable QR. */
export default function MemoriesHostSummary({ eventId, refreshKey }: Props) {
	const [summary, setSummary] = useState<MemoriesSpaceHostSummary | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

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
	}, [eventId, refreshKey]);

	if (error) return <p className="dashboard-memories__error">{error}</p>;
	if (!summary) return null;

	// Only worth an alert when there is something left to download.
	const deletionDays =
		summary.photos + summary.videos > 0
			? resolveMemoriesRetentionWarningDays(
					summary,
					new Date(),
					MEMORIES_RETENTION_WARNING_DAYS,
				)
			: null;

	const copyUrl = async () => {
		try {
			await navigator.clipboard.writeText(summary.publicUrl);
			setNotice(copy.copied);
		} catch {
			setNotice(summary.publicUrl);
		}
	};

	return (
		<div className="memories-host-summary" aria-label={copy.eyebrow}>
			<div className="memories-host-summary__status">
				<span className={`dashboard-badge ${MEMORIES_WINDOW_BADGE[summary.windowState]}`}>
					{MEMORIES_WINDOW_LABEL[summary.windowState]}
				</span>
				<p>{buildMemoriesHostStatusCopy(summary)}</p>
			</div>
			{deletionDays !== null ? (
				<p className="memories-host-summary__alert" role="alert">
					{copy.deletionCountdown(deletionDays)}
				</p>
			) : null}
			<dl className="memories-space__stats">
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
					<dd>{summary.guestsWithUploads.toLocaleString('es-MX')}</dd>
				</div>
				<div>
					<dt>{copy.capacity}</dt>
					<dd>{summary.capacityRemainingPercent} %</dd>
				</div>
			</dl>
			{summary.lastAcceptedAt ? (
				<p className="memories-host-summary__meta">
					{copy.lastUpload(
						formatMemoriesDateTime(summary.lastAcceptedAt, summary.timeZone),
					)}
				</p>
			) : null}
			{summary.windowState !== 'expired' ? (
				<div className="memories-host-summary__share">
					<span>{copy.shareTitle}</span>
					<code>{summary.publicUrl}</code>
					<div className="dashboard-memories__header-actions">
						<a
							className="btn-secondary"
							href={memoriesOrganizerApi.qrUrl(eventId)}
							download
						>
							{copy.downloadQr}
						</a>
						<button
							type="button"
							className="btn-secondary"
							onClick={() => void copyUrl()}
						>
							{copy.copyUrl}
						</button>
					</div>
				</div>
			) : null}
			{notice ? (
				<p className="dashboard-status" role="status">
					{notice}
				</p>
			) : null}
		</div>
	);
}
