import { useId, useRef, useState, type ChangeEvent } from 'react';
import { valentinaMemoriesCaptureCopy } from '@/data/valentina-memories.data';
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

type ValentinaMemoriesCaptureProps = {
	signUrl: string | null;
	readVideoDurationSeconds?: (file: File) => Promise<number>;
};

const ACCEPT = Object.keys(VALENTINA_MEMORIES_ALLOWED_MIME_TYPES).join(',');

async function requestSignature(signUrl: string, file: File): Promise<string> {
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

	const uploadUrl =
		typeof payload === 'object' && payload !== null
			? (payload as { uploadUrl?: unknown }).uploadUrl
			: null;
	if (typeof uploadUrl !== 'string' || uploadUrl.length === 0) {
		throw Object.assign(new Error('sign_failed'), { issue: 'sign_failed' as const });
	}

	return uploadUrl;
}

async function putOriginalFile(uploadUrl: string, file: File): Promise<void> {
	const mimeType = normalizeMemoriesMimeType(file.type);
	const response = await fetch(uploadUrl, {
		method: 'PUT',
		headers: { 'Content-Type': mimeType },
		body: file,
	});
	if (!response.ok) {
		throw Object.assign(new Error('put_failed'), { issue: 'put_failed' as const });
	}
}

export default function ValentinaMemoriesCapture({
	signUrl,
	readVideoDurationSeconds,
}: ValentinaMemoriesCaptureProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedFileRef = useRef<File | null>(null);
	const [status, setStatus] = useState<CaptureStatus>(signUrl ? 'idle' : 'error');
	const [issue, setIssue] = useState<ValentinaMemoriesCaptureIssue | null>(
		signUrl ? null : 'unavailable',
	);

	const copy = valentinaMemoriesCaptureCopy;
	const unavailable = !signUrl || issue === 'unavailable';
	const message = issue ? valentinaMemoriesIssueCopy(issue) : null;

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
			const uploadUrl = await requestSignature(signUrl, file);
			await putOriginalFile(uploadUrl, file);
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
								{copy.success}
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
				</>
			)}
		</div>
	);
}
