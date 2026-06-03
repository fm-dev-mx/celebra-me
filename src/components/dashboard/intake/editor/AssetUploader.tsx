import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';
import { getCsrfToken } from '@/lib/csrf';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/intake/constants';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface Props {
	invitationId: string;
	onUploaded?: () => void;
}

function formatMaxSize(): string {
	const mb = Math.round(MAX_FILE_SIZE / (1024 * 1024));
	return `${mb} MB`;
}

function formatAllowedTypes(): string {
	return ALLOWED_MIME_TYPES.map((m) => {
		if (m === 'image/jpeg') return 'JPG';
		if (m === 'image/png') return 'PNG';
		if (m === 'image/webp') return 'WebP';
		return m;
	}).join(', ');
}

export default function AssetUploader({ invitationId, onUploaded }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploadState, setUploadState] = useState<UploadState>('idle');
	const [errorMessage, setErrorMessage] = useState('');
	const [dragOver, setDragOver] = useState(false);
	const [errorId] = useState(
		() => `asset-uploader-error-${Math.random().toString(36).slice(2, 9)}`,
	);

	function validate(file: File): string | null {
		if (!ALLOWED_MIME_TYPES.includes(file.type)) {
			return 'Solo se permiten imágenes JPG, PNG o WebP.';
		}
		if (file.size > MAX_FILE_SIZE) {
			return 'La imagen supera el límite de 10 MB.';
		}
		return null;
	}

	function isBusy(): boolean {
		return uploadState === 'uploading';
	}

	async function upload(file: File) {
		if (isBusy()) return;

		const validationError = validate(file);
		if (validationError) {
			setErrorMessage(validationError);
			setUploadState('error');
			return;
		}

		setUploadState('uploading');
		setErrorMessage('');

		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('displayName', file.name);

			const csrfToken = getCsrfToken();
			const response = await fetch(
				`/api/dashboard/intake/${encodeURIComponent(invitationId)}/assets/upload`,
				{
					method: 'POST',
					body: formData,
					headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
				},
			);

			let result: unknown = null;
			try {
				result = await response.json();
			} catch {
				setErrorMessage('La respuesta del servidor no fue válida.');
				setUploadState('error');
				return;
			}

			if (!response.ok) {
				const message =
					(result as { error?: { message?: string } })?.error?.message ||
					'No se pudo subir la imagen. Intenta nuevamente.';
				setErrorMessage(message);
				setUploadState('error');
				return;
			}

			setUploadState('success');
			setErrorMessage('');
			onUploaded?.();
		} catch {
			setErrorMessage('No se pudo subir la imagen. Intenta nuevamente.');
			setUploadState('error');
		} finally {
			if (inputRef.current) inputRef.current.value = '';
		}
	}

	function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (file) upload(file);
	}

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragOver(false);
		if (isBusy()) return;
		const file = event.dataTransfer.files?.[0];
		if (file) upload(file);
	}

	function handleDragOver(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		if (!dragOver) setDragOver(true);
	}

	function handleDragLeave() {
		setDragOver(false);
	}

	function handleClick() {
		if (isBusy()) return;
		inputRef.current?.click();
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick();
		}
	}

	const busy = isBusy();
	const allowedHint = `Formatos permitidos: ${formatAllowedTypes()}. Tamaño máximo: ${formatMaxSize()}.`;
	const stateLabel =
		uploadState === 'uploading'
			? 'Subiendo imagen...'
			: uploadState === 'success'
				? 'Imagen subida correctamente.'
				: 'Arrastra imágenes aquí o haz clic para subir';

	return (
		<div
			className={`asset-uploader ${dragOver ? 'asset-uploader--drag-over' : ''} ${
				busy ? 'asset-uploader--uploading' : ''
			}`}
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onClick={handleClick}
			role="button"
			tabIndex={busy ? -1 : 0}
			aria-label="Zona para subir una imagen"
			aria-describedby={errorMessage ? errorId : undefined}
			aria-busy={busy}
			aria-disabled={busy}
			onKeyDown={handleKeyDown}
		>
			<input
				ref={inputRef}
				type="file"
				accept={ALLOWED_MIME_TYPES.join(',')}
				className="asset-uploader__input"
				onChange={handleFileChange}
				hidden
				disabled={busy}
				aria-hidden="true"
				tabIndex={-1}
			/>
			<span className="asset-uploader__label" aria-live="polite">
				{stateLabel}
			</span>
			<span className="asset-uploader__hint">{allowedHint}</span>
			{uploadState === 'error' && errorMessage && (
				<p id={errorId} className="asset-uploader__error" role="alert">
					{errorMessage}
				</p>
			)}
		</div>
	);
}
