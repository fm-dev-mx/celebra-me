import type { ChangeEventHandler, RefObject } from 'react';
import {
	VALENTINA_MEMORIES_MAX_CAPTION_LENGTH,
	type ValentinaMemoriesGuestQuota,
} from '@/data/valentina-memories-media.contract';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';

type UploadPanelProps = {
	inputId: string;
	inputRef: RefObject<HTMLInputElement | null>;
	accept: string;
	selectedFile: File | null;
	selectedPreviewUrl: string | null;
	selectedCaption: string;
	status: 'idle' | 'busy' | 'success' | 'error';
	originAllowed: boolean;
	quota: ValentinaMemoriesGuestQuota | null;
	onFileChange: ChangeEventHandler<HTMLInputElement>;
	onCaptionChange: (value: string) => void;
	onConfirmUpload: () => void;
	onCancelSelection: () => void;
};

function formatFileSize(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GuestQuotaStatus({ quota }: { quota: ValentinaMemoriesGuestQuota | null }) {
	if (!quota) return null;
	return (
		<div className="status-page__quota" aria-label="Cupo disponible">
			<span>
				{quota.files.remaining} de {quota.files.limit} archivos disponibles
			</span>
			<span>
				{quota.videos.remaining} de {quota.videos.limit} videos disponibles
			</span>
		</div>
	);
}

export default function ValentinaMemoriesUploadPanel({
	inputId,
	inputRef,
	accept,
	selectedFile,
	selectedPreviewUrl,
	selectedCaption,
	status,
	originAllowed,
	quota,
	onFileChange,
	onCaptionChange,
	onConfirmUpload,
	onCancelSelection,
}: UploadPanelProps) {
	const copy = valentinaMemoriesCaptureCopy;
	return (
		<>
			<input
				id={inputId}
				ref={inputRef}
				className="status-page__file-input"
				type="file"
				accept={accept}
				disabled={status === 'busy' || !originAllowed}
				aria-label={copy.chooseFile}
				onChange={onFileChange}
			/>
			{selectedFile ? (
				<section
					className="status-page__selection"
					aria-labelledby={`${inputId}-selection-title`}
				>
					<div className="status-page__selection-heading">
						<span className="status-page__step-label">Paso 2 de 2</span>
						<h2 id={`${inputId}-selection-title`}>{copy.selectedFileTitle}</h2>
					</div>
					<div className="status-page__selection-preview">
						{selectedPreviewUrl ? (
							selectedFile.type.startsWith('video/') ? (
								<video controls preload="metadata" src={selectedPreviewUrl} />
							) : (
								<img
									src={selectedPreviewUrl}
									alt="Vista previa del recuerdo seleccionado"
								/>
							)
						) : (
							<div className="status-page__selection-placeholder">
								{copy.selectedFileFallback}
							</div>
						)}
						<div className="status-page__selection-meta">
							<strong>{selectedFile.name}</strong>
							<span>
								{copy.selectedFileSize}: {formatFileSize(selectedFile.size)}
							</span>
						</div>
					</div>
					<label htmlFor={`${inputId}-caption`}>{copy.captionLabel}</label>
					<textarea
						id={`${inputId}-caption`}
						value={selectedCaption}
						maxLength={VALENTINA_MEMORIES_MAX_CAPTION_LENGTH}
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
						<span className="status-page__step-label">Paso 1 de 2</span>
						<h2 id={`${inputId}-chooser-title`}>{copy.chooseFileTitle}</h2>
						<p>{copy.chooseFileBody}</p>
					</div>
					<label
						htmlFor={inputId}
						className={`status-page__upload-zone${originAllowed ? '' : ' is-disabled'}`}
					>
						<span className="status-page__upload-zone-icon" aria-hidden="true">
							＋
						</span>
						<strong>{copy.chooseFile}</strong>
						<span>{copy.chooseFileHint}</span>
					</label>
					<GuestQuotaStatus quota={quota} />
					<details className="status-page__details">
						<summary>{copy.detailsLabel}</summary>
						<p>{copy.limitsDetails}</p>
						<p>{copy.privacyHint}</p>
					</details>
				</section>
			)}
		</>
	);
}
