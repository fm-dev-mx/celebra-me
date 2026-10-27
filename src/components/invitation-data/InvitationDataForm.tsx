import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
	findMissingRequiredFields,
	INVITATION_DATA_STEPS,
	suggestMainMessages,
	type InvitationDataAnswers,
	type InvitationDataField,
	type InvitationDataFieldName,
	type InvitationDataIssues,
	type InvitationDataPhoto,
	type InvitationDataStatus,
} from '@/lib/invitation-data/form';

interface FormState {
	status: InvitationDataStatus;
	eventType: string | null;
	answers: InvitationDataAnswers;
	expiresAt: string;
	lastSavedAt: string | null;
	submittedAt: string | null;
}

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface ApiFailure {
	message: string;
	issues?: InvitationDataIssues;
	/** HTTP status; absent when the request never reached the server. */
	status?: number;
}

const ENDPOINT = '/api/mi-invitacion';
const AUTOSAVE_DELAY_MS = 1200;
const RETRY_DELAY_MS = 5000;
const REVIEW_STEP = INVITATION_DATA_STEPS.length;

class InvitationDataApiError extends Error {
	readonly issues?: InvitationDataIssues;
	readonly status?: number;

	constructor(failure: ApiFailure) {
		super(failure.message);
		this.issues = failure.issues;
		this.status = failure.status;
	}

	/** Offline, rate limited or a server error: worth retrying. */
	get retryable(): boolean {
		return this.status === undefined || this.status === 429 || this.status >= 500;
	}
}

async function callApi(body: Record<string, unknown>): Promise<FormState> {
	let response: Response;
	try {
		response = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			credentials: 'same-origin',
		});
	} catch {
		throw new InvitationDataApiError({
			message: 'Sin conexión. Revise su internet; sus datos siguen en esta pantalla.',
		});
	}
	const payload = (await response.json().catch(() => null)) as {
		data?: FormState;
		error?: { message?: string; details?: { issues?: InvitationDataIssues } };
	} | null;
	if (!response.ok || !payload?.data) {
		throw new InvitationDataApiError({
			message: payload?.error?.message || 'No se pudo completar. Intente de nuevo.',
			issues: payload?.error?.details?.issues,
			status: response.status,
		});
	}
	return payload.data;
}

function formatDateTime(value: string): string {
	return new Date(value).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
}

function formatDate(value: string): string {
	return new Date(value).toLocaleDateString('es-MX', { dateStyle: 'long' });
}

function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inputType(field: InvitationDataField): string {
	if (field.kind === 'url') return 'url';
	if (field.kind === 'date') return 'date';
	if (field.kind === 'time') return 'time';
	return 'text';
}

function SaveIndicator({
	state,
	lastSavedAt,
	errorMessage,
}: {
	state: SaveState;
	lastSavedAt: string | null;
	errorMessage: string;
}) {
	let text = '';
	if (state === 'saving' || state === 'pending') text = 'Guardando…';
	else if (state === 'error') text = errorMessage;
	else if (lastSavedAt) text = `Guardado ${formatDateTime(lastSavedAt)}`;
	return (
		<p
			className={`invitation-data__save invitation-data__save--${state}`}
			role="status"
			aria-live="polite"
		>
			{text}
		</p>
	);
}

interface PhotoUploaderProps {
	token: string;
	photos: InvitationDataPhoto[];
	onPhotosChange: (photos: InvitationDataPhoto[]) => void;
	error?: string;
}

function PhotoUploader({ token, photos, onPhotosChange, error }: PhotoUploaderProps) {
	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState('');
	const [dragOver, setDragOver] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);

	const handleUploadFiles = async (files: FileList | File[]) => {
		const fileArray = Array.from(files);
		if (fileArray.length === 0) return;

		setUploadError('');
		if (photos.length + fileArray.length > 10) {
			setUploadError('Puede subir como máximo 10 fotos en total.');
			return;
		}

		for (const file of fileArray) {
			if (file.size > 10 * 1024 * 1024) {
				setUploadError(`«${file.name}» supera el límite de 10 MB.`);
				return;
			}
			if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
				setUploadError(`«${file.name}» no es un formato admitido (solo JPG, PNG o WebP).`);
				return;
			}
		}

		setUploading(true);
		try {
			let currentPhotos = [...photos];
			for (const file of fileArray) {
				const formData = new FormData();
				formData.set('token', token);
				formData.set('file', file, file.name);

				const response = await fetch('/api/mi-invitacion/photos', {
					method: 'POST',
					body: formData,
					credentials: 'same-origin',
				});
				const payload = (await response.json().catch(() => null)) as {
					data?: { photo: InvitationDataPhoto; answers: InvitationDataAnswers };
					error?: { message?: string };
				} | null;

				if (!response.ok || !payload?.data) {
					throw new Error(payload?.error?.message || 'No se pudo subir la foto.');
				}
				if (payload.data.answers?.photos) {
					currentPhotos = payload.data.answers.photos;
				} else {
					currentPhotos.push(payload.data.photo);
				}
				onPhotosChange(currentPhotos);
			}
		} catch (err) {
			setUploadError(err instanceof Error ? err.message : 'Error al subir las fotos.');
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = '';
		}
	};

	const handleDelete = async (photoId: string) => {
		setUploadError('');
		try {
			const response = await fetch('/api/mi-invitacion/photos', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token, photoId }),
				credentials: 'same-origin',
			});
			const payload = (await response.json().catch(() => null)) as {
				data?: { success: boolean; answers: InvitationDataAnswers };
				error?: { message?: string };
			} | null;
			if (!response.ok || !payload?.data) {
				throw new Error(payload?.error?.message || 'No se pudo eliminar la foto.');
			}
			if (payload.data.answers?.photos) {
				onPhotosChange(payload.data.answers.photos);
			} else {
				onPhotosChange(photos.filter((p) => p.id !== photoId));
			}
		} catch (err) {
			setUploadError(err instanceof Error ? err.message : 'Error al eliminar la foto.');
		}
	};

	return (
		<div className="invitation-data__photos-container">
			{photos.length > 0 && (
				<ul className="invitation-data__photo-list">
					{photos.map((photo) => (
						<li key={photo.id} className="invitation-data__photo-item">
							<img
								src={photo.url}
								alt={photo.name}
								className="invitation-data__photo-thumb"
							/>
							<div className="invitation-data__photo-info">
								<span className="invitation-data__photo-name">{photo.name}</span>
								<span className="invitation-data__photo-size">
									{formatBytes(photo.size)}
								</span>
							</div>
							<button
								type="button"
								className="invitation-data__photo-delete"
								onClick={() => void handleDelete(photo.id)}
								aria-label={`Eliminar foto ${photo.name}`}
							>
								Eliminar
							</button>
						</li>
					))}
				</ul>
			)}

			{photos.length < 10 && (
				<div
					className={`invitation-data__dropzone${dragOver ? ' invitation-data__dropzone--drag-over' : ''}${uploading ? ' invitation-data__dropzone--busy' : ''}`}
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={(e) => {
						e.preventDefault();
						setDragOver(false);
						if (e.dataTransfer.files) void handleUploadFiles(e.dataTransfer.files);
					}}
				>
					<input
						ref={inputRef}
						id="invitation-data-photos-input"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						multiple
						disabled={uploading}
						className="invitation-data__file-input"
						onChange={(e) => {
							if (e.target.files) void handleUploadFiles(e.target.files);
						}}
					/>
					<label
						htmlFor="invitation-data-photos-input"
						className="invitation-data__dropzone-label"
					>
						{uploading ? (
							<span role="status">Subiendo fotos…</span>
						) : (
							<>
								<span className="invitation-data__dropzone-title">
									Elegir fotos o arrastrarlas aquí
								</span>
								<span className="invitation-data__dropzone-hint">
									JPG, PNG o WebP · Hasta 10 MB por foto ({10 - photos.length}{' '}
									restantes)
								</span>
							</>
						)}
					</label>
				</div>
			)}

			{(uploadError || error) && (
				<p className="invitation-data__error" role="alert">
					{uploadError || error}
				</p>
			)}
		</div>
	);
}

function PhotosField({
	field,
	token,
	photos,
	onPhotosChange,
	error,
}: {
	field: InvitationDataField;
	token?: string;
	photos?: InvitationDataPhoto[];
	onPhotosChange?: (photos: InvitationDataPhoto[]) => void;
	error?: string;
}) {
	return (
		<div className={`invitation-data__field${error ? ' invitation-data__field--error' : ''}`}>
			<label htmlFor="invitation-data-photos-input">
				{field.label}
				{field.requiredToSubmit ? <span aria-hidden="true"> *</span> : null}
			</label>
			{field.help && (
				<p id="invitation-data-photos-help" className="invitation-data__help">
					{field.help}
				</p>
			)}
			<PhotoUploader
				token={token ?? ''}
				photos={photos ?? []}
				onPhotosChange={onPhotosChange ?? (() => undefined)}
				error={error}
			/>
		</div>
	);
}

function SuggestionsBox({
	suggestions,
	onSelect,
}: {
	suggestions: readonly string[];
	onSelect: (value: string) => void;
}) {
	if (suggestions.length === 0) return null;
	return (
		<div className="invitation-data__suggestions">
			<p>Sugerencias:</p>
			{suggestions.map((suggestion, index) => (
				<button
					key={suggestion}
					type="button"
					className="invitation-data__suggestion"
					onClick={() => onSelect(suggestion)}
					aria-label={`Usar sugerencia ${index + 1}: ${suggestion}`}
				>
					{suggestion}
				</button>
			))}
		</div>
	);
}

interface FieldProps {
	field: InvitationDataField;
	value: string;
	error?: string;
	eventType: string | null;
	token?: string;
	photos?: InvitationDataPhoto[];
	onPhotosChange?: (photos: InvitationDataPhoto[]) => void;
	onChange: (name: InvitationDataFieldName, value: string) => void;
}

function Field({
	field,
	value,
	error,
	eventType,
	token,
	photos,
	onPhotosChange,
	onChange,
}: FieldProps) {
	if (field.kind === 'photos') {
		return (
			<PhotosField
				field={field}
				token={token}
				photos={photos}
				onPhotosChange={onPhotosChange}
				error={error}
			/>
		);
	}

	const id = `invitation-data-${field.name}`;
	const describedBy = [field.help ? `${id}-help` : '', error ? `${id}-error` : '']
		.filter(Boolean)
		.join(' ');
	const common = {
		id,
		name: field.name,
		value,
		maxLength: field.maxLength,
		placeholder: field.placeholder,
		'aria-invalid': error ? true : undefined,
		'aria-describedby': describedBy || undefined,
		'aria-required': field.requiredToSubmit ? true : undefined,
	};
	const suggestions = field.name === 'mainMessage' ? suggestMainMessages(eventType) : [];

	return (
		<div className={`invitation-data__field${error ? ' invitation-data__field--error' : ''}`}>
			<label htmlFor={id}>
				{field.label}
				{field.requiredToSubmit ? <span aria-hidden="true"> *</span> : null}
			</label>
			{field.kind === 'textarea' ? (
				<textarea
					{...common}
					rows={field.maxLength > 800 ? 6 : 4}
					onChange={(event) => onChange(field.name, event.target.value)}
				/>
			) : (
				<input
					{...common}
					type={inputType(field)}
					inputMode={field.kind === 'url' ? 'url' : undefined}
					autoComplete="off"
					onChange={(event) => onChange(field.name, event.target.value)}
				/>
			)}
			<SuggestionsBox
				suggestions={suggestions}
				onSelect={(val) => onChange(field.name, val)}
			/>
			{field.help && (
				<p id={`${id}-help`} className="invitation-data__help">
					{field.help}
				</p>
			)}
			{error && (
				<p id={`${id}-error`} className="invitation-data__error">
					{error}
				</p>
			)}
		</div>
	);
}

export interface InvitationDataFormProps {
	token: string;
}

/**
 * «Datos de su invitación»: a step-by-step mobile form behind a private link. Every change is
 * autosaved; sending it notifies Celebra-me, and later corrections keep saving.
 */
const InvitationDataForm: React.FC<InvitationDataFormProps> = ({ token }) => {
	const [loadError, setLoadError] = useState('');
	const [form, setForm] = useState<FormState | null>(null);
	const [answers, setAnswers] = useState<InvitationDataAnswers>({});
	const [step, setStep] = useState(0);
	const [issues, setIssues] = useState<InvitationDataIssues>({});
	const [saveState, setSaveState] = useState<SaveState>('idle');
	const [saveError, setSaveError] = useState('');
	const [submitError, setSubmitError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [justSubmitted, setJustSubmitted] = useState(false);

	const answersRef = useRef<InvitationDataAnswers>({});
	const dirtyRef = useRef(false);
	const savingRef = useRef<Promise<void> | null>(null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const headingRef = useRef<HTMLHeadingElement | null>(null);
	const flushRef = useRef<() => Promise<void>>(async () => undefined);

	useEffect(() => {
		let cancelled = false;
		callApi({ token, action: 'load' })
			.then((state) => {
				if (cancelled) return;
				answersRef.current = state.answers;
				setAnswers(state.answers);
				setForm(state);
			})
			.catch((error: unknown) => {
				if (!cancelled)
					setLoadError(error instanceof Error ? error.message : String(error));
			});
		return () => {
			cancelled = true;
		};
	}, [token]);

	const flushSave = useCallback(async (): Promise<void> => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (savingRef.current) await savingRef.current;
		if (!dirtyRef.current) return;
		dirtyRef.current = false;
		setSaveState('saving');
		const run = callApi({ token, action: 'save', answers: answersRef.current })
			.then((state) => {
				setForm(state);
				setSaveState(dirtyRef.current ? 'pending' : 'saved');
				setIssues({});
			})
			.catch((error: unknown) => {
				dirtyRef.current = true;
				setSaveState('error');
				if (error instanceof InvitationDataApiError && error.issues) {
					// A field the server rejects waits for the client to fix it.
					setIssues(error.issues);
					setSaveError('Revise los datos marcados para poder guardar.');
					return;
				}
				if (error instanceof InvitationDataApiError && !error.retryable) {
					// A replaced or expired link never recovers; retrying would only add requests.
					setSaveError(error.message);
					return;
				}
				setSaveError('No se pudo guardar. Lo intentaremos de nuevo en unos segundos.');
				timerRef.current = setTimeout(() => {
					void flushRef.current();
				}, RETRY_DELAY_MS);
			})
			.finally(() => {
				savingRef.current = null;
			});
		savingRef.current = run;
		await run;
	}, [token]);

	useEffect(() => {
		flushRef.current = flushSave;
	}, [flushSave]);

	const scheduleSave = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			void flushSave();
		}, AUTOSAVE_DELAY_MS);
	}, [flushSave]);

	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === 'hidden') void flushSave();
		};
		document.addEventListener('visibilitychange', onHide);
		return () => {
			document.removeEventListener('visibilitychange', onHide);
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [flushSave]);

	const handleChange = (name: InvitationDataFieldName, value: string) => {
		const next = { ...answersRef.current, [name]: value };
		answersRef.current = next;
		dirtyRef.current = true;
		setAnswers(next);
		setSaveState('pending');
		setIssues((current) => {
			if (!current[name]) return current;
			const rest = { ...current };
			delete rest[name];
			return rest;
		});
		scheduleSave();
	};

	const handlePhotosChange = (photos: InvitationDataPhoto[]) => {
		const next = { ...answersRef.current, photos };
		answersRef.current = next;
		setAnswers(next);
		setIssues((current) => {
			if (!current.photos) return current;
			const rest = { ...current };
			delete rest.photos;
			return rest;
		});
	};

	const goToStep = (target: number) => {
		void flushSave();
		setStep(target);
		setJustSubmitted(false);
		requestAnimationFrame(() => headingRef.current?.focus());
	};

	const handleSubmit = async () => {
		const missing = findMissingRequiredFields(answersRef.current);
		if (Object.keys(missing).length > 0) {
			setIssues(missing);
			setSubmitError('Faltan datos necesarios. Revise los campos marcados.');
			return;
		}
		setSubmitting(true);
		setSubmitError('');
		if (timerRef.current) clearTimeout(timerRef.current);
		if (savingRef.current) await savingRef.current;
		try {
			dirtyRef.current = false;
			const state = await callApi({
				token,
				action: 'submit',
				answers: answersRef.current,
			});
			setForm(state);
			setSaveState('saved');
			setIssues({});
			setJustSubmitted(true);
			requestAnimationFrame(() => headingRef.current?.focus());
		} catch (error) {
			dirtyRef.current = true;
			if (error instanceof InvitationDataApiError && error.issues) setIssues(error.issues);
			setSubmitError(error instanceof Error ? error.message : String(error));
		} finally {
			setSubmitting(false);
		}
	};

	if (loadError) {
		return (
			<main className="invitation-data invitation-data--message">
				<h1 className="invitation-data__title">No pudimos abrir su formulario</h1>
				<p className="invitation-data__intro" role="alert">
					{loadError}
				</p>
			</main>
		);
	}

	if (!form) {
		return (
			<main className="invitation-data invitation-data--message">
				<p role="status">Cargando su formulario…</p>
			</main>
		);
	}

	const isSubmitted = form.status === 'submitted';

	if (justSubmitted) {
		return (
			<main className="invitation-data invitation-data--message">
				<p className="invitation-data__eyebrow">Celebra-me</p>
				<h1 className="invitation-data__title" tabIndex={-1} ref={headingRef}>
					¡Recibimos sus datos!
				</h1>
				<p className="invitation-data__intro">
					Con esto empezamos a preparar su invitación. Si quiere corregir algo, vuelva a
					este mismo enlace antes del {formatDate(form.expiresAt)}; se guarda solo.
				</p>
				<p className="invitation-data__intro">
					Revisaremos sus datos y fotos para preparar su invitación.
				</p>
				<button
					type="button"
					className="invitation-data__secondary"
					onClick={() => goToStep(0)}
				>
					Revisar mis datos
				</button>
			</main>
		);
	}

	const missingRequired = findMissingRequiredFields(answers);
	const current = INVITATION_DATA_STEPS[step];
	const progress = Math.round(((step + 1) / (REVIEW_STEP + 1)) * 100);

	return (
		<main className="invitation-data">
			<header className="invitation-data__header">
				<p className="invitation-data__eyebrow">Datos de su invitación</p>
				<p className="invitation-data__progress-label">
					Paso {step + 1} de {REVIEW_STEP + 1}
				</p>
				<progress
					className="invitation-data__progress"
					aria-label="Avance del formulario"
					max={100}
					value={progress}
				/>
				{isSubmitted && (
					<p className="invitation-data__notice">
						Ya recibimos sus datos. Si corrige algo, se guarda solo y le avisamos a
						Celebra-me.
					</p>
				)}
			</header>

			{current ? (
				<section className="invitation-data__step" aria-labelledby="invitation-data-step">
					<h1
						id="invitation-data-step"
						className="invitation-data__title"
						tabIndex={-1}
						ref={headingRef}
					>
						{current.title}
					</h1>
					<p className="invitation-data__intro">{current.intro}</p>
					{current.fields.map((field) => (
						<Field
							key={field.name}
							field={field}
							value={
								field.name === 'photos'
									? ''
									: ((answers[field.name as keyof InvitationDataAnswers] as
											string | undefined) ?? '')
							}
							error={issues[field.name]}
							eventType={form.eventType}
							token={token}
							photos={answers.photos}
							onPhotosChange={handlePhotosChange}
							onChange={handleChange}
						/>
					))}
				</section>
			) : (
				<section className="invitation-data__step" aria-labelledby="invitation-data-step">
					<h1
						id="invitation-data-step"
						className="invitation-data__title"
						tabIndex={-1}
						ref={headingRef}
					>
						Revise y envíe
					</h1>
					<p className="invitation-data__intro">
						Puede enviar aunque falten datos opcionales; los completamos juntos por
						WhatsApp.
					</p>
					<ul className="invitation-data__review">
						{INVITATION_DATA_STEPS.map((reviewStep, index) => {
							const isPhotos = reviewStep.id === 'fotos';
							const filled = isPhotos
								? (answers.photos ?? []).length
								: reviewStep.fields.filter((field) => {
										const val =
											answers[field.name as keyof InvitationDataAnswers];
										return typeof val === 'string' && val.trim().length > 0;
									}).length;
							const missing = reviewStep.fields.filter(
								(field) => missingRequired[field.name],
							);
							const countText = isPhotos
								? `${filled} foto(s) subida(s)`
								: `${filled} de ${reviewStep.fields.length} datos`;
							return (
								<li key={reviewStep.id}>
									<div>
										<strong>{reviewStep.title}</strong>
										<span>{countText}</span>
										{missing.map((field) => (
											<span
												key={field.name}
												className="invitation-data__error"
											>
												Falta: {field.label}
											</span>
										))}
									</div>
									<button
										type="button"
										className="invitation-data__link"
										onClick={() => goToStep(index)}
										aria-label={`Editar ${reviewStep.title}`}
									>
										Editar
									</button>
								</li>
							);
						})}
					</ul>
					{submitError && (
						<p className="invitation-data__error" role="alert">
							{submitError}
						</p>
					)}
					<button
						type="button"
						className="invitation-data__primary"
						disabled={submitting}
						onClick={() => void handleSubmit()}
					>
						{submitting
							? 'Enviando…'
							: isSubmitted
								? 'Enviar mis cambios'
								: 'Enviar mis datos'}
					</button>
				</section>
			)}

			<footer className="invitation-data__footer">
				<SaveIndicator
					state={saveState}
					lastSavedAt={form.lastSavedAt}
					errorMessage={saveError}
				/>
				<div className="invitation-data__nav">
					{step > 0 && (
						<button
							type="button"
							className="invitation-data__secondary"
							onClick={() => goToStep(step - 1)}
						>
							Anterior
						</button>
					)}
					{step < REVIEW_STEP && (
						<button
							type="button"
							className="invitation-data__primary"
							onClick={() => goToStep(step + 1)}
						>
							{step === REVIEW_STEP - 1 ? 'Revisar' : 'Siguiente'}
						</button>
					)}
				</div>
			</footer>
		</main>
	);
};

export default InvitationDataForm;
