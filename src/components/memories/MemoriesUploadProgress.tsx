import { memoriesCaptureCopy as copy } from '@/lib/memories/copy';
import { memoriesIssueCopy } from '@/lib/memories/client/media-prep';
import { isMemoriesQueueActive, type MemoriesQueueEntry } from '@/lib/memories/client/upload-queue';

type Props = {
	entries: readonly MemoriesQueueEntry[];
	offline: boolean;
	canRetry: boolean;
	onRetry: (id: string) => void;
	onCancelPending: () => void;
};

/** Issues a retry can fix; the rest need a different file or are final. */
const RETRYABLE = new Set([
	'rate_limited',
	'uploads_in_progress',
	'sign_failed',
	'put_failed',
	'network_failed',
	'upload_expired',
	'unavailable',
]);

function savedLabel(entry: MemoriesQueueEntry): string | null {
	if (entry.result === 'rejected') return copy.completionRejected;
	if (entry.result === 'duplicate') return copy.duplicate;
	if (entry.result === 'deleted') return copy.deleted;
	return null;
}

function EntryStatus({
	entry,
	canRetry,
	onRetry,
}: {
	entry: MemoriesQueueEntry;
	canRetry: boolean;
	onRetry: (id: string) => void;
}) {
	if (entry.status === 'failed' && entry.issue) {
		return (
			<>
				<p
					className="memories-upload-row__status memories-upload-row__status--error"
					role="alert"
				>
					{memoriesIssueCopy(entry.issue)}
				</p>
				{canRetry && RETRYABLE.has(entry.issue) ? (
					<button
						type="button"
						className="status-page__btn status-page__btn--outline memories-upload-row__retry"
						onClick={() => onRetry(entry.id)}
					>
						{copy.retry}
					</button>
				) : null}
			</>
		);
	}
	if (entry.status === 'done') {
		const note = savedLabel(entry);
		return (
			<p
				className={`memories-upload-row__status${note ? ' memories-upload-row__status--error' : ' memories-upload-row__status--done'}`}
			>
				{note ?? copy.statusDone}
			</p>
		);
	}
	if (entry.status === 'uploading') {
		const percent = Math.round(entry.progress * 100);
		return (
			<progress
				className="memories-upload-row__bar"
				value={percent}
				max={100}
				aria-label={`${entry.file.name}: ${percent} %`}
			/>
		);
	}
	const label =
		entry.status === 'optimizing'
			? copy.statusOptimizing
			: entry.status === 'confirming'
				? copy.statusConfirming
				: entry.status === 'preparing'
					? copy.statusPreparing
					: copy.statusWaiting;
	return <p className="memories-upload-row__status">{label}</p>;
}

/** Per-file progress for a batch, with the total on top and a retry per failed file. */
export default function MemoriesUploadProgress({
	entries,
	offline,
	canRetry,
	onRetry,
	onCancelPending,
}: Props) {
	const total = entries.length;
	const finished = entries.filter(
		(entry) => entry.status === 'done' || entry.status === 'failed',
	).length;
	const running = entries.some(
		(entry) => isMemoriesQueueActive(entry) || entry.status === 'waiting',
	);
	const waiting = entries.some((entry) => entry.status === 'waiting');

	return (
		<section
			className="memories-upload-progress"
			aria-label={copy.progressTitle(finished, total)}
		>
			{running ? (
				<div className="memories-upload-progress__head" aria-live="polite">
					<h2>{copy.progressTitle(Math.min(finished + 1, total), total)}</h2>
					<progress
						value={finished}
						max={Math.max(total, 1)}
						aria-label={copy.progressTitle(finished, total)}
					/>
					<p>{copy.keepOpen}</p>
				</div>
			) : null}
			{offline ? (
				<p className="memories-notice memories-notice--warning" role="status">
					{copy.offline}
				</p>
			) : null}
			<ul className="memories-upload-progress__list">
				{entries.map((entry) => (
					<li key={entry.id} className="memories-upload-row">
						<span className="memories-upload-row__name">{entry.file.name}</span>
						<EntryStatus entry={entry} canRetry={canRetry} onRetry={onRetry} />
					</li>
				))}
			</ul>
			{waiting ? (
				<button
					type="button"
					className="status-page__text-button"
					onClick={onCancelPending}
				>
					{copy.cancelPending}
				</button>
			) : null}
		</section>
	);
}
