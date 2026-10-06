import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { MemoriesGuestQuota } from '@/lib/memories/contract/catalog';
import { MEMORIES_MAX_CAPTION_LENGTH } from '@/lib/memories/contract/limits';
import { isMemoriesVideoMime } from '@/lib/memories/contract/media-policy';
import { buildMemoriesUploadLimitsCopy, memoriesCaptureCopy as copy } from '@/lib/memories/copy';
import { memoriesIssueCopy } from '@/lib/memories/client/media-prep';
import type { MemoriesQueueEntry } from '@/lib/memories/client/upload-queue';

type UploadPanelProps = {
	inputId: string;
	accept: string;
	maxSessionVideos: number;
	/** Files picked and not yet queued (`ready` or `invalid`). */
	entries: readonly MemoriesQueueEntry[];
	quota: MemoriesGuestQuota | null;
	onFilesSelected: (files: File[]) => void;
	onRemove: (id: string) => void;
	onStart: (caption: string) => void;
	onCancel: () => void;
};

function usePreviewUrls(entries: readonly MemoriesQueueEntry[]): Record<string, string> {
	const [urls, setUrls] = useState<Record<string, string>>({});
	const key = entries.map((entry) => entry.id).join('|');
	useEffect(() => {
		if (typeof URL.createObjectURL !== 'function') return;
		const next: Record<string, string> = {};
		for (const entry of entries) next[entry.id] = URL.createObjectURL(entry.file);
		setUrls(next);
		return () => {
			for (const url of Object.values(next)) URL.revokeObjectURL(url);
		};
		// Object URLs follow the set of picked files, not each status change.
	}, [key]);
	return urls;
}

function QuotaMeter({ quota, adding }: { quota: MemoriesGuestQuota; adding: number }) {
	const remainingAfter = Math.max(0, quota.files.remaining - adding);
	const used = quota.files.limit - remainingAfter;
	const percent = quota.files.limit > 0 ? Math.round((used / quota.files.limit) * 100) : 0;
	return (
		<div className="memories-guest-quota">
			<div className="memories-guest-quota__label">
				<span>{copy.quotaRemaining(remainingAfter, quota.files.limit)}</span>
				<span>{copy.quotaVideosRemaining(quota.videos.remaining)}</span>
			</div>
			<progress
				className="memories-guest-quota__bar"
				value={used}
				max={Math.max(quota.files.limit, 1)}
				aria-label={`${percent} % de su espacio usado`}
			/>
		</div>
	);
}

function FilePicker({
	inputId,
	accept,
	label,
	onFilesSelected,
	variant,
}: {
	inputId: string;
	accept: string;
	label: string;
	onFilesSelected: (files: File[]) => void;
	variant: 'zone' | 'tile';
}) {
	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files ?? []);
		event.target.value = '';
		if (files.length > 0) onFilesSelected(files);
	};
	return (
		<>
			<input
				id={inputId}
				className="status-page__file-input"
				type="file"
				accept={accept}
				multiple
				aria-label={copy.chooseFile}
				onChange={onChange}
			/>
			<label
				htmlFor={inputId}
				className={
					variant === 'zone'
						? 'status-page__btn memories-guest-picker'
						: 'memories-guest-preview__add'
				}
			>
				<svg
					width="22"
					height="22"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					{variant === 'zone' ? (
						<>
							<path d="M4 8h3l2-3h6l2 3h3v11H4z" />
							<circle cx="12" cy="13" r="3.5" />
						</>
					) : (
						<path d="M12 5v14M5 12h14" />
					)}
				</svg>
				{label}
			</label>
		</>
	);
}

/** Step 1 picks one or more files; step 2 previews them before the upload starts. */
export default function MemoriesUploadPanel({
	inputId,
	accept,
	maxSessionVideos,
	entries,
	quota,
	onFilesSelected,
	onRemove,
	onStart,
	onCancel,
}: UploadPanelProps) {
	const [caption, setCaption] = useState('');
	const urls = usePreviewUrls(entries);
	const ready = useMemo(() => entries.filter((entry) => entry.status === 'ready'), [entries]);
	const invalidEntries = entries.filter((entry) => entry.status === 'invalid');

	if (entries.length === 0) {
		return (
			<section
				className="memories-guest-chooser"
				aria-labelledby={`${inputId}-chooser-title`}
			>
				<h2 id={`${inputId}-chooser-title`}>{copy.chooseFileTitle}</h2>
				<p>{copy.chooseFileBody}</p>
				<FilePicker
					inputId={inputId}
					accept={accept}
					label={copy.chooseFile}
					onFilesSelected={onFilesSelected}
					variant="zone"
				/>
				{quota ? <QuotaMeter quota={quota} adding={0} /> : null}
				<details className="status-page__details">
					<summary>{copy.detailsLabel}</summary>
					<p>{buildMemoriesUploadLimitsCopy(maxSessionVideos)}</p>
					<p>{copy.privacyHint}</p>
				</details>
			</section>
		);
	}

	return (
		<section className="memories-guest-review" aria-labelledby={`${inputId}-review-title`}>
			<div>
				<h2 id={`${inputId}-review-title`}>{copy.reviewTitle(entries.length)}</h2>
				<p>{copy.reviewBody}</p>
			</div>
			<ul className="memories-guest-preview" aria-label="Archivos elegidos">
				{entries.map((entry) => {
					const url = urls[entry.id];
					const video = isMemoriesVideoMime(entry.file.type);
					return (
						<li
							key={entry.id}
							className={`memories-guest-preview__item${entry.status === 'invalid' ? ' memories-guest-preview__item--invalid' : ''}`}
						>
							{url && entry.status !== 'invalid' ? (
								video ? (
									<video
										src={url}
										muted
										playsInline
										preload="metadata"
										aria-hidden="true"
									/>
								) : (
									<img src={url} alt="" />
								)
							) : null}
							<span className="memories-guest-preview__name">{entry.file.name}</span>
							{entry.status === 'invalid' && entry.issue ? (
								<span className="memories-guest-preview__issue">
									{copy.invalidTile[entry.issue] ?? copy.invalidTileFallback}
								</span>
							) : null}
							<button
								type="button"
								className="memories-guest-preview__remove"
								aria-label={copy.removeFile(entry.file.name)}
								onClick={() => onRemove(entry.id)}
							>
								<span aria-hidden="true">×</span>
							</button>
						</li>
					);
				})}
				<li>
					<FilePicker
						inputId={inputId}
						accept={accept}
						label={copy.addMore}
						onFilesSelected={onFilesSelected}
						variant="tile"
					/>
				</li>
			</ul>
			{invalidEntries.length > 0 ? (
				<div className="memories-notice memories-notice--danger" role="alert">
					<p>{copy.invalidSummary(invalidEntries.length)}</p>
					<ul className="memories-guest-review__issues">
						{invalidEntries.map((entry) => (
							<li key={entry.id}>
								<strong>{entry.file.name}:</strong>{' '}
								{entry.issue ? memoriesIssueCopy(entry.issue) : null}
							</li>
						))}
					</ul>
				</div>
			) : null}
			<details className="status-page__details">
				<summary>{copy.captionToggle}</summary>
				<label htmlFor={`${inputId}-caption`}>{copy.captionLabelAll}</label>
				<textarea
					id={`${inputId}-caption`}
					value={caption}
					maxLength={MEMORIES_MAX_CAPTION_LENGTH}
					placeholder={copy.captionPlaceholder}
					onChange={(event) => setCaption(event.target.value)}
				/>
			</details>
			{quota ? <QuotaMeter quota={quota} adding={ready.length} /> : null}
			<button
				type="button"
				className="status-page__btn"
				disabled={ready.length === 0}
				onClick={() => onStart(caption)}
			>
				{copy.confirmUploadCount(ready.length)}
			</button>
			<button type="button" className="status-page__text-button" onClick={onCancel}>
				{copy.cancelSelection}
			</button>
		</section>
	);
}
