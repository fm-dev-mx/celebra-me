import type { ChangeEventHandler, RefObject } from 'react';
import type { MemoriesGuestQuota } from '@/lib/memories/contract/catalog';
import { MEMORIES_MAX_CAPTION_LENGTH } from '@/lib/memories/contract/limits';
import { isMemoriesVideoMime } from '@/lib/memories/contract/media-policy';
import {
	buildMemoriesUploadLimitsCopy,
	buildMemoriesUploadSummaryCopy,
	formatMemoriesFileSize,
	memoriesCaptureCopy as copy,
} from '@/lib/memories/copy';

type UploadPanelProps = {
	inputId: string;
	inputRef: RefObject<HTMLInputElement | null>;
	accept: string;
	maxSessionVideos: number;
	selectedFile: File | null;
	selectedPreviewUrl: string | null;
	selectedCaption: string;
	status: 'idle' | 'busy' | 'success' | 'error';
	quota: MemoriesGuestQuota | null;
	onFileChange: ChangeEventHandler<HTMLInputElement>;
	onCaptionChange: (value: string) => void;
	onConfirmUpload: () => void;
	onCancelSelection: () => void;
};

function GuestQuotaStatus({ quota }: { quota: MemoriesGuestQuota | null }) {
	if (!quota) return null;
	return (
		<div className="status-page__quota" aria-label={copy.quotaLabel}>
			<span>
				{quota.files.remaining} de {quota.files.limit} archivos disponibles
			</span>
			<span>
				{quota.videos.remaining} de {quota.videos.limit} videos disponibles
			</span>
		</div>
	);
}

export default function MemoriesUploadPanel({
	inputId,
	inputRef,
	accept,
	maxSessionVideos,
	selectedFile,
	selectedPreviewUrl,
	selectedCaption,
	status,
	quota,
	onFileChange,
	onCaptionChange,
	onConfirmUpload,
	onCancelSelection,
}: UploadPanelProps) {
	return (
		<>
			<input
				id={inputId}
				ref={inputRef}
				className="status-page__file-input"
				type="file"
				accept={accept}
				disabled={status === 'busy'}
				aria-label={copy.chooseFile}
				onChange={onFileChange}
			/>
			{selectedFile ? (
				<section
					className="status-page__selection"
					aria-labelledby={`${inputId}-selection-title`}
				>
					<div className="status-page__selection-heading">
						<span className="status-page__step-label">{copy.stepTwo}</span>
						<h2 id={`${inputId}-selection-title`}>{copy.selectedFileTitle}</h2>
					</div>
					<div className="status-page__selection-preview">
						{selectedPreviewUrl ? (
							isMemoriesVideoMime(selectedFile.type) ? (
								<video controls preload="metadata" src={selectedPreviewUrl} />
							) : (
								<img src={selectedPreviewUrl} alt={copy.selectedPreviewAlt} />
							)
						) : (
							<div className="status-page__selection-placeholder">
								{copy.selectedFileFallback}
							</div>
						)}
						<div className="status-page__selection-meta">
							<strong>{selectedFile.name}</strong>
							<span>
								{copy.selectedFileSize}: {formatMemoriesFileSize(selectedFile.size)}
							</span>
						</div>
					</div>
					<label htmlFor={`${inputId}-caption`}>{copy.captionLabel}</label>
					<textarea
						id={`${inputId}-caption`}
						value={selectedCaption}
						maxLength={MEMORIES_MAX_CAPTION_LENGTH}
						placeholder={copy.captionPlaceholder}
						disabled={status === 'busy'}
						onChange={(event) => onCaptionChange(event.target.value)}
					/>
					{status === 'idle' ? (
						<div className="status-page__selection-actions">
							<button
								type="button"
								className="status-page__btn"
								onClick={onConfirmUpload}
							>
								{copy.confirmUpload}
							</button>
							<label
								htmlFor={inputId}
								className="status-page__btn status-page__btn--outline"
							>
								{copy.changeFile}
							</label>
							<button
								type="button"
								className="status-page__text-button"
								onClick={onCancelSelection}
							>
								{copy.cancelSelection}
							</button>
						</div>
					) : null}
				</section>
			) : (
				<section
					className="status-page__chooser"
					aria-labelledby={`${inputId}-chooser-title`}
				>
					<div className="status-page__chooser-heading">
						<span className="status-page__step-label">{copy.stepOne}</span>
						<h2 id={`${inputId}-chooser-title`}>{copy.chooseFileTitle}</h2>
						<p>{copy.chooseFileBody}</p>
					</div>
					<label htmlFor={inputId} className="status-page__upload-zone">
						<span className="status-page__upload-zone-icon" aria-hidden="true">
							＋
						</span>
						<strong>{copy.chooseFile}</strong>
						<span>{buildMemoriesUploadSummaryCopy(maxSessionVideos)}</span>
					</label>
					<GuestQuotaStatus quota={quota} />
					<details className="status-page__details">
						<summary>{copy.detailsLabel}</summary>
						<p>{buildMemoriesUploadLimitsCopy(maxSessionVideos)}</p>
						<p>{copy.privacyHint}</p>
					</details>
				</section>
			)}
		</>
	);
}
