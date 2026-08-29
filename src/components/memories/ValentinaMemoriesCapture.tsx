import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';
import {
	VALENTINA_MEMORIES_MAX_CAPTION_LENGTH,
	VALENTINA_MEMORIES_RECOVERY_CODE_LENGTH,
} from '@/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_ALLOWED_MIME_TYPES,
	normalizeMemoriesMimeType,
} from '@/data/valentina-memories-upload.contract';
import {
	mapValentinaMemoriesSignError,
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
	status: 'uploading' | 'validating' | 'accepted' | 'rejected' | 'deleted';
	createdAt: string;
};

type ValentinaMemoriesCaptureProps = {
	signUrl: string | null;
	catalogEnabled?: boolean;
	readVideoDurationSeconds?: (file: File) => Promise<number>;
};

const ACCEPT = Object.keys(VALENTINA_MEMORIES_ALLOWED_MIME_TYPES).join(',');
const SESSION_ENDPOINT = '/api/memories/valentina/session';
const ITEMS_ENDPOINT = '/api/memories/valentina/items';

async function requestSignature(
	signUrl: string,
	file: File,
): Promise<{ uploadUrl: string; objectKey: string }> {
	const mimeType = normalizeMemoriesMimeType(file.type);
	const response = await fetch(signUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ mimeType, sizeBytes: file.size }),
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
	const parsed =
		typeof payload === 'object' && payload !== null
			? (payload as { uploadUrl?: unknown; objectKey?: unknown })
			: {};
	if (typeof parsed.uploadUrl !== 'string' || !parsed.uploadUrl) {
		throw Object.assign(new Error('sign_failed'), { issue: 'sign_failed' as const });
	}
	return {
		uploadUrl: parsed.uploadUrl,
		objectKey: typeof parsed.objectKey === 'string' ? parsed.objectKey : '',
	};
}

async function putOriginalFile(uploadUrl: string, file: File): Promise<void> {
	const response = await fetch(uploadUrl, {
		method: 'PUT',
		headers: { 'Content-Type': normalizeMemoriesMimeType(file.type) },
		body: file,
	});
	if (!response.ok)
		throw Object.assign(new Error('put_failed'), { issue: 'put_failed' as const });
}

function itemStatusLabel(item: CatalogItem): string {
	const copy = valentinaMemoriesCaptureCopy;
	if (item.status === 'accepted') return copy.accepted;
	if (item.status === 'rejected') return copy.rejected;
	if (item.status === 'deleted') return copy.deleted;
	return copy.validationPending;
}

export default function ValentinaMemoriesCapture({
	signUrl,
	catalogEnabled = false,
	readVideoDurationSeconds,
}: ValentinaMemoriesCaptureProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedFileRef = useRef<File | null>(null);
	const sessionReadyRef = useRef(false);
	const [status, setStatus] = useState<CaptureStatus>(signUrl ? 'idle' : 'error');
	const [issue, setIssue] = useState<ValentinaMemoriesCaptureIssue | null>(
		signUrl ? null : 'unavailable',
	);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const [items, setItems] = useState<CatalogItem[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [captionDraft, setCaptionDraft] = useState('');
	const [recoveryDraft, setRecoveryDraft] = useState('');
	const [recoveryError, setRecoveryError] = useState(false);
	const copy = valentinaMemoriesCaptureCopy;
	const unavailable = !signUrl || issue === 'unavailable';
	const message = issue ? valentinaMemoriesIssueCopy(issue) : null;

	const loadItems = async () => {
		if (!catalogEnabled) return;
		const response = await fetch(ITEMS_ENDPOINT, { headers: { Accept: 'application/json' } });
		if (!response.ok) return;
		sessionReadyRef.current = true;
		const payload = (await response.json()) as { items?: CatalogItem[] };
		if (Array.isArray(payload.items)) setItems(payload.items);
	};

	useEffect(() => {
		void loadItems();
	}, [catalogEnabled]);

	const ensureSession = async (): Promise<void> => {
		if (!catalogEnabled) return;
		if (sessionReadyRef.current) return;
		const response = await fetch(SESSION_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		});
		if (!response.ok)
			throw Object.assign(new Error('session_failed'), { issue: 'network_failed' as const });
		sessionReadyRef.current = true;
		const payload = (await response.json()) as { recoveryCode?: unknown };
		if (typeof payload.recoveryCode === 'string') setRecoveryCode(payload.recoveryCode);
	};

	const recoverSession = async () => {
		if (!catalogEnabled) return;
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
		await loadItems();
	};

	const resetInput = () => {
		if (inputRef.current) inputRef.current.value = '';
	};

	const uploadSelectedFile = async (file: File) => {
		if (!signUrl) {
			setStatus('error');
			setIssue('unavailable');
			return;
		}
		const fileIssue = validateValentinaMemoriesFile(file);
		if (fileIssue) {
			setStatus('error');
			setIssue(fileIssue);
			return;
		}
		setStatus('busy');
		setIssue(null);
		const durationIssue = await validateValentinaMemoriesVideoDuration(
			file,
			readVideoDurationSeconds,
		);
		if (durationIssue) {
			setStatus('error');
			setIssue(durationIssue);
			return;
		}
		try {
			await ensureSession();
			const durationSeconds = readVideoDurationSeconds
				? await readVideoDurationSeconds(file)
				: undefined;
			const signed = await requestSignature(signUrl, file);
			let mediaId: string | undefined;
			if (catalogEnabled) {
				const registerResponse = await fetch(ITEMS_ENDPOINT, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'register',
						objectKey: signed.objectKey,
						mimeType: normalizeMemoriesMimeType(file.type),
						sizeBytes: file.size,
						durationSeconds,
					}),
				});
				if (!registerResponse.ok)
					throw Object.assign(new Error('register_failed'), {
						issue: 'sign_failed' as const,
					});
				const registered = (await registerResponse.json()) as { item?: { id?: unknown } };
				if (typeof registered.item?.id !== 'string')
					throw Object.assign(new Error('register_failed'), {
						issue: 'sign_failed' as const,
					});
				mediaId = registered.item.id;
			}
			await putOriginalFile(signed.uploadUrl, file);
			if (catalogEnabled && mediaId) {
				const completeResponse = await fetch(
					`${ITEMS_ENDPOINT}/${encodeURIComponent(mediaId)}`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ action: 'complete' }),
					},
				);
				if (!completeResponse.ok)
					throw Object.assign(new Error('complete_failed'), {
						issue: 'put_failed' as const,
					});
				await loadItems();
			}
			selectedFileRef.current = null;
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
		resetInput();
		setStatus('idle');
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
					{status !== 'success' ? (
						<>
							<input
								id={inputId}
								ref={inputRef}
								className="status-page__file-input"
								type="file"
								accept={ACCEPT}
								disabled={status === 'busy'}
								aria-label={copy.chooseFile}
								onChange={onFileChange}
							/>
							<label
								htmlFor={inputId}
								className={`status-page__btn${status === 'busy' ? ' is-disabled' : ''}`}
							>
								{status === 'busy' ? copy.uploading : copy.chooseFile}
							</label>
							<p className="status-page__status">{copy.chooseFileHint}</p>
						</>
					) : (
						<>
							<p className="status-page__status" role="status">
								{catalogEnabled ? copy.validationPending : copy.success}
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
							{copy.uploading}
						</p>
					) : null}
					{recoveryCode ? (
						<aside className="status-page__recovery" role="note">
							<strong>{copy.recoveryCodeTitle}</strong>
							<code>{recoveryCode}</code>
							<span>{copy.recoveryCodeHint}</span>
						</aside>
					) : null}
					{catalogEnabled && !recoveryCode ? (
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
					{catalogEnabled ? (
						<section className="status-page__memories" aria-label={copy.myMemories}>
							<h2>{copy.myMemories}</h2>
							{items.length === 0 ? (
								<p>{copy.noMemories}</p>
							) : (
								items.map((item) => (
									<article key={item.id} className="status-page__memory-card">
										{item.status !== 'deleted' ? (
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
