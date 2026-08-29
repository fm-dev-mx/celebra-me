import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';
import {
	VALENTINA_MEMORIES_MAX_CAPTION_LENGTH,
	VALENTINA_MEMORIES_DISPLAY_NAME_MAX_LENGTH,
	VALENTINA_MEMORIES_RECOVERY_CODE_LENGTH,
	type ValentinaMemoriesGuestProfile,
} from '@/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_ALLOWED_MIME_TYPES,
	resolveValentinaMemoriesFileMimeType,
} from '@/data/valentina-memories-upload.contract';
import {
	calculateFileSha256Hex,
	createSecureClientRequestId,
	mapValentinaMemoriesSignError,
	measureVideoDurationSeconds,
	readValentinaMemoriesSignErrorCode,
	validateValentinaMemoriesFile,
	validateValentinaMemoriesVideoDuration,
	valentinaMemoriesIssueCopy,
	type ValentinaMemoriesCaptureIssue,
} from '@/lib/memories/valentina-memories-client';

type CaptureStatus = 'idle' | 'busy' | 'success' | 'error';
type CatalogItem = {
	id: string;
	mimeType: string;
	sizeBytes: number;
	durationSeconds: number | null;
	caption: string;
	status: 'uploading' | 'validating' | 'accepted' | 'rejected' | 'deleted' | 'duplicate';
	createdAt: string;
};
type CompletedCatalogStatus = Extract<
	CatalogItem['status'],
	'accepted' | 'duplicate' | 'rejected' | 'deleted'
>;

type ValentinaMemoriesCaptureProps = {
	readVideoDurationSeconds?: (file: File) => Promise<number>;
};

const ACCEPT = Object.keys(VALENTINA_MEMORIES_ALLOWED_MIME_TYPES).join(',');
const SESSION_ENDPOINT = '/api/memories/valentina/session';
const ITEMS_ENDPOINT = '/api/memories/valentina/items';

async function reserveUpload(
	file: File,
	checksumSha256: string,
	durationSeconds: number | undefined,
	clientRequestId: string,
): Promise<{
	item: CatalogItem;
	upload: { uploadUrl: string; requiredHeaders: Record<string, string> };
}> {
	const mimeType = resolveValentinaMemoriesFileMimeType(file);
	if (!mimeType)
		throw Object.assign(new Error('unsupported_type'), { issue: 'unsupported_type' as const });
	const response = await fetch(ITEMS_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'reserve',
			mimeType,
			sizeBytes: file.size,
			checksumSha256,
			durationSeconds,
			clientRequestId,
		}),
	});
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}
	if (!response.ok) {
		throw Object.assign(new Error('sign_failed'), {
			issue: mapValentinaMemoriesSignError(
				response.status,
				readValentinaMemoriesSignErrorCode(payload),
			),
		});
	}
	const parsed = payload as {
		item?: CatalogItem;
		upload?: { uploadUrl?: unknown; requiredHeaders?: unknown };
	};
	if (
		!parsed.item?.id ||
		typeof parsed.upload?.uploadUrl !== 'string' ||
		typeof parsed.upload.requiredHeaders !== 'object' ||
		parsed.upload.requiredHeaders === null
	) {
		throw Object.assign(new Error('sign_failed'), { issue: 'sign_failed' as const });
	}
	return {
		item: parsed.item,
		upload: {
			uploadUrl: parsed.upload.uploadUrl,
			requiredHeaders: parsed.upload.requiredHeaders as Record<string, string>,
		},
	};
}

async function putOriginalFile(
	uploadUrl: string,
	requiredHeaders: Record<string, string>,
	file: File,
): Promise<void> {
	const response = await fetch(uploadUrl, {
		method: 'PUT',
		headers: requiredHeaders,
		body: file,
	});
	if (!response.ok && response.status !== 412)
		throw Object.assign(new Error('put_failed'), { issue: 'put_failed' as const });
}

function isCompletedCatalogStatus(
	status: CatalogItem['status'] | undefined,
): status is CompletedCatalogStatus {
	return (
		status === 'accepted' ||
		status === 'duplicate' ||
		status === 'rejected' ||
		status === 'deleted'
	);
}

async function completeReservedUpload(itemId: string): Promise<CompletedCatalogStatus> {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const response = await fetch(`${ITEMS_ENDPOINT}/${encodeURIComponent(itemId)}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'complete' }),
		});
		if (response.ok) {
			const payload = (await response.json().catch(() => null)) as {
				item?: { status?: CatalogItem['status'] };
			} | null;
			if (isCompletedCatalogStatus(payload?.item?.status)) return payload.item.status;
		}
		if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * 3 ** attempt));
	}
	throw Object.assign(new Error('complete_failed'), { issue: 'put_failed' as const });
}

function completionCopy(status: CompletedCatalogStatus): string {
	const copy = valentinaMemoriesCaptureCopy;
	if (status === 'duplicate') return copy.duplicate;
	if (status === 'rejected') return copy.rejected;
	if (status === 'deleted') return copy.deleted;
	return copy.success;
}

function itemStatusLabel(item: CatalogItem): string {
	const copy = valentinaMemoriesCaptureCopy;
	if (item.status === 'accepted') return copy.accepted;
	if (item.status === 'duplicate') return copy.duplicate;
	if (item.status === 'rejected') return copy.rejected;
	if (item.status === 'deleted') return copy.deleted;
	return copy.validationPending;
}

export default function ValentinaMemoriesCapture({
	readVideoDurationSeconds,
}: ValentinaMemoriesCaptureProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedFileRef = useRef<File | null>(null);
	const selectedRequestIdRef = useRef<string | null>(null);
	const sessionReadyRef = useRef(false);
	const copy = valentinaMemoriesCaptureCopy;
	const [status, setStatus] = useState<CaptureStatus>('idle');
	const [progressMessage, setProgressMessage] = useState<string>(copy.preparing);
	const [completionMessage, setCompletionMessage] = useState<string>(copy.success);
	const [issue, setIssue] = useState<ValentinaMemoriesCaptureIssue | null>(null);
	const [profile, setProfile] = useState<ValentinaMemoriesGuestProfile | null>(null);
	const [displayNameDraft, setDisplayNameDraft] = useState('');
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const [items, setItems] = useState<CatalogItem[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [captionDraft, setCaptionDraft] = useState('');
	const [recoveryDraft, setRecoveryDraft] = useState('');
	const [recoveryError, setRecoveryError] = useState(false);
	const unavailable = issue === 'unavailable';
	const message = issue ? valentinaMemoriesIssueCopy(issue) : null;

	const loadItems = async () => {
		const response = await fetch(ITEMS_ENDPOINT, { headers: { Accept: 'application/json' } });
		if (!response.ok) return;
		sessionReadyRef.current = true;
		const payload = (await response.json()) as { items?: CatalogItem[] };
		if (Array.isArray(payload.items)) setItems(payload.items);
	};

	useEffect(() => {
		void (async () => {
			const response = await fetch(SESSION_ENDPOINT, {
				headers: { Accept: 'application/json' },
			});
			if (!response.ok) return;
			const payload = (await response.json()) as { profile?: ValentinaMemoriesGuestProfile };
			if (!payload.profile) return;
			setProfile(payload.profile);
			setDisplayNameDraft(payload.profile.displayName);
			sessionReadyRef.current = true;
			await loadItems();
		})();
	}, []);

	const startSession = async () => {
		const response = await fetch(SESSION_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'create', displayName: displayNameDraft }),
		});
		if (!response.ok) {
			setIssue('network_failed');
			return;
		}
		const payload = (await response.json()) as {
			profile?: ValentinaMemoriesGuestProfile;
			recoveryCode?: unknown;
		};
		if (!payload.profile) return;
		setProfile(payload.profile);
		sessionReadyRef.current = true;
		if (typeof payload.recoveryCode === 'string') setRecoveryCode(payload.recoveryCode);
	};

	const saveProfile = async () => {
		const response = await fetch(SESSION_ENDPOINT, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ displayName: displayNameDraft }),
		});
		if (!response.ok) return;
		const payload = (await response.json()) as { profile?: ValentinaMemoriesGuestProfile };
		if (payload.profile) setProfile(payload.profile);
	};

	const recoverSession = async () => {
		setRecoveryError(false);
		const response = await fetch(SESSION_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'recover', recoveryCode: recoveryDraft }),
		});
		if (!response.ok) {
			setRecoveryError(true);
			return;
		}
		sessionReadyRef.current = true;
		setRecoveryDraft('');
		const payload = (await response.json()) as { profile?: ValentinaMemoriesGuestProfile };
		if (payload.profile) {
			setProfile(payload.profile);
			setDisplayNameDraft(payload.profile.displayName);
		}
		await loadItems();
	};

	const resetInput = () => {
		if (inputRef.current) inputRef.current.value = '';
	};

	const uploadSelectedFile = async (file: File) => {
		if (!sessionReadyRef.current || !profile) {
			setStatus('error');
			setIssue('network_failed');
			return;
		}
		const fileIssue = validateValentinaMemoriesFile(file);
		if (fileIssue) {
			setStatus('error');
			setIssue(fileIssue);
			return;
		}
		setStatus('busy');
		setProgressMessage(copy.preparing);
		setIssue(null);
		let durationSeconds: number | undefined;
		const durationIssue = await validateValentinaMemoriesVideoDuration(
			file,
			async (candidate) => {
				durationSeconds = await (readVideoDurationSeconds ?? measureVideoDurationSeconds)(
					candidate,
				);
				return durationSeconds;
			},
		);
		if (durationIssue) {
			setStatus('error');
			setIssue(durationIssue);
			return;
		}
		try {
			const checksumSha256 = await calculateFileSha256Hex(file);
			const clientRequestId = selectedRequestIdRef.current ?? createSecureClientRequestId();
			selectedRequestIdRef.current = clientRequestId;
			const reservation = await reserveUpload(
				file,
				checksumSha256,
				durationSeconds,
				clientRequestId,
			);
			setProgressMessage(copy.uploading);
			await putOriginalFile(
				reservation.upload.uploadUrl,
				reservation.upload.requiredHeaders,
				file,
			);
			setProgressMessage(copy.confirming);
			const completedStatus = await completeReservedUpload(reservation.item.id);
			setCompletionMessage(completionCopy(completedStatus));
			await loadItems();
			selectedFileRef.current = null;
			selectedRequestIdRef.current = null;
			resetInput();
			setStatus('success');
			setIssue(null);
		} catch (error) {
			const nextIssue =
				error instanceof Error && 'issue' in error
					? ((error as { issue?: ValentinaMemoriesCaptureIssue }).issue ?? 'sign_failed')
					: 'network_failed';
			setStatus('error');
			setIssue(nextIssue);
		}
	};

	const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		selectedFileRef.current = file;
		selectedRequestIdRef.current = createSecureClientRequestId();
		void uploadSelectedFile(file);
	};
	const onRetry = () => {
		const file = selectedFileRef.current;
		if (!file) {
			resetInput();
			setStatus('idle');
			setIssue(null);
			return;
		}
		void uploadSelectedFile(file);
	};
	const onUploadAnother = () => {
		selectedFileRef.current = null;
		selectedRequestIdRef.current = null;
		resetInput();
		setStatus('idle');
		setProgressMessage(copy.preparing);
		setIssue(null);
	};

	const saveCaption = async (item: CatalogItem) => {
		const response = await fetch(`${ITEMS_ENDPOINT}/${encodeURIComponent(item.id)}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ caption: captionDraft }),
		});
		if (response.ok) {
			setEditingId(null);
			await loadItems();
		}
	};
	const deleteItem = async (item: CatalogItem) => {
		if (!window.confirm(copy.confirmDelete)) return;
		const response = await fetch(`${ITEMS_ENDPOINT}/${encodeURIComponent(item.id)}`, {
			method: 'DELETE',
		});
		if (response.ok) await loadItems();
	};

	return (
		<div className="status-page__capture" data-capture="valentina-memories">
			{unavailable ? (
				<p className="status-page__status status-page__status--error" role="status">
					{copy.unavailable}
				</p>
			) : (
				<>
					{profile ? (
						<section
							className="status-page__recovery"
							aria-label="Su perfil de recuerdos"
						>
							<label htmlFor={`${inputId}-display-name`}>Su nombre o apodo</label>
							<div>
								<input
									id={`${inputId}-display-name`}
									value={displayNameDraft}
									maxLength={VALENTINA_MEMORIES_DISPLAY_NAME_MAX_LENGTH}
									onChange={(event) => setDisplayNameDraft(event.target.value)}
								/>
								<button type="button" onClick={() => void saveProfile()}>
									Guardar nombre
								</button>
							</div>
							<small>Alias de su sesión: {profile.guestAlias}</small>
						</section>
					) : (
						<section
							className="status-page__recovery"
							aria-label="Iniciar sesión de recuerdos"
						>
							<strong>Antes de subir, escriba su nombre o apodo</strong>
							<label htmlFor={`${inputId}-new-display-name`}>Nombre o apodo</label>
							<div>
								<input
									id={`${inputId}-new-display-name`}
									value={displayNameDraft}
									maxLength={VALENTINA_MEMORIES_DISPLAY_NAME_MAX_LENGTH}
									autoComplete="nickname"
									onChange={(event) => setDisplayNameDraft(event.target.value)}
								/>
								<button
									type="button"
									disabled={!displayNameDraft.trim()}
									onClick={() => void startSession()}
								>
									Continuar
								</button>
							</div>
						</section>
					)}
					{status !== 'success' ? (
						<>
							<input
								id={inputId}
								ref={inputRef}
								className="status-page__file-input"
								type="file"
								accept={ACCEPT}
								disabled={status === 'busy' || !profile}
								aria-label={copy.chooseFile}
								onChange={onFileChange}
							/>
							<label
								htmlFor={inputId}
								className={`status-page__btn${status === 'busy' || !profile ? ' is-disabled' : ''}`}
							>
								{status === 'busy' ? progressMessage : copy.chooseFile}
							</label>
							<p className="status-page__status">{copy.chooseFileHint}</p>
							<p className="status-page__status status-page__status--privacy">
								{copy.privacyHint}
							</p>
						</>
					) : (
						<>
							<p className="status-page__status" role="status">
								{completionMessage}
							</p>
							<button
								type="button"
								className="status-page__btn status-page__btn--outline"
								onClick={onUploadAnother}
							>
								{copy.uploadAnother}
							</button>
						</>
					)}
					{status === 'error' && message ? (
						<>
							<p
								className="status-page__status status-page__status--error"
								role="alert"
							>
								{message}
							</p>
							<button
								type="button"
								className="status-page__btn status-page__btn--outline"
								onClick={onRetry}
							>
								{copy.retry}
							</button>
						</>
					) : null}
					{status === 'busy' ? (
						<p className="status-page__status" role="status" aria-live="polite">
							{progressMessage}
						</p>
					) : null}
					{recoveryCode ? (
						<aside className="status-page__recovery" role="note">
							<strong>{copy.recoveryCodeTitle}</strong>
							<code>{recoveryCode}</code>
							<span>{copy.recoveryCodeHint}</span>
						</aside>
					) : null}
					{!profile && !recoveryCode ? (
						<aside className="status-page__recovery status-page__recovery--restore">
							<strong>{copy.recoveryPrompt}</strong>
							<div>
								<label htmlFor={`${inputId}-recovery`}>
									{copy.recoveryInputLabel}
								</label>
								<input
									id={`${inputId}-recovery`}
									value={recoveryDraft}
									maxLength={VALENTINA_MEMORIES_RECOVERY_CODE_LENGTH}
									autoComplete="one-time-code"
									onChange={(event) =>
										setRecoveryDraft(event.target.value.toUpperCase())
									}
								/>
								<button
									type="button"
									onClick={() => void recoverSession()}
									disabled={!recoveryDraft}
								>
									{copy.recover}
								</button>
							</div>
							{recoveryError ? <span role="alert">{copy.recoveryFailed}</span> : null}
						</aside>
					) : null}
					{profile ? (
						<section className="status-page__memories" aria-label={copy.myMemories}>
							<h2>{copy.myMemories}</h2>
							{items.length === 0 ? (
								<p>{copy.noMemories}</p>
							) : (
								items.map((item) => (
									<article key={item.id} className="status-page__memory-card">
										{item.status === 'accepted' ? (
											item.mimeType.startsWith('video/') ? (
												<video
													controls
													preload="metadata"
													src={`${ITEMS_ENDPOINT}/${encodeURIComponent(item.id)}`}
												/>
											) : (
												<img
													loading="lazy"
													src={`${ITEMS_ENDPOINT}/${encodeURIComponent(item.id)}`}
													alt={item.caption || copy.myMemories}
												/>
											)
										) : null}
										<p>{itemStatusLabel(item)}</p>
										{editingId === item.id ? (
											<div>
												<input
													value={captionDraft}
													maxLength={
														VALENTINA_MEMORIES_MAX_CAPTION_LENGTH
													}
													onChange={(event) =>
														setCaptionDraft(event.target.value)
													}
													aria-label={copy.editCaption}
												/>
												<button
													type="button"
													onClick={() => void saveCaption(item)}
												>
													{copy.saveCaption}
												</button>
											</div>
										) : (
											<button
												type="button"
												onClick={() => {
													setEditingId(item.id);
													setCaptionDraft(item.caption);
												}}
											>
												{copy.editCaption}
											</button>
										)}
										{item.status !== 'deleted' ? (
											<button
												type="button"
												onClick={() => void deleteItem(item)}
											>
												{copy.deleteMemory}
											</button>
										) : null}
									</article>
								))
							)}
						</section>
					) : null}
				</>
			)}
		</div>
	);
}
