import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { getCsrfToken } from '@/lib/csrf';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/intake/constants';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface Props {
	invitationId: string;
	onUploaded?: () => void;
}

export default function AssetUploader({ invitationId, onUploaded }: Props) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploadState, setUploadState] = useState<UploadState>('idle');
	const [errorMessage, setErrorMessage] = useState('');
	const [dragOver, setDragOver] = useState(false);

	function validate(file: File): string | null {
		if (!ALLOWED_MIME_TYPES.includes(file.type)) {
			return 'Tipo de archivo no soportado. Solo se aceptan imágenes WebP, JPEG y PNG.';
		}
		if (file.size > MAX_FILE_SIZE) {
			return 'El archivo excede el tamaño máximo de 10 MB.';
		}
		return null;
	}

	async function upload(file: File) {
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

			const result = await response.json();
			if (!response.ok) {
				throw new Error(result?.error?.message || 'Error al subir la imagen.');
			}

			setUploadState('success');
			onUploaded?.();
		} catch (err) {
			setErrorMessage(
				err instanceof Error ? err.message : 'Error de red al subir la imagen.',
			);
			setUploadState('error');
		}
	}

	function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (file) upload(file);
	}

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragOver(false);
		const file = event.dataTransfer.files?.[0];
		if (file) upload(file);
	}

	function handleDragOver(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setDragOver(true);
	}

	function handleDragLeave() {
		setDragOver(false);
	}

	function handleClick() {
		inputRef.current?.click();
	}

	return (
		<div
			className={`asset-uploader ${dragOver ? 'asset-uploader--drag-over' : ''} ${uploadState === 'uploading' ? 'asset-uploader--uploading' : ''}`}
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onClick={handleClick}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') handleClick();
			}}
		>
			<input
				ref={inputRef}
				type="file"
				accept="image/webp,image/jpeg,image/png"
				className="asset-uploader__input"
				onChange={handleFileChange}
				hidden
			/>
			{uploadState === 'uploading' ? (
				<span>Subiendo imagen...</span>
			) : (
				<span>Arrastra imágenes aquí o haz clic para subir</span>
			)}
			{uploadState === 'error' && errorMessage && (
				<p className="asset-uploader__error">{errorMessage}</p>
			)}
		</div>
	);
}
