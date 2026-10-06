import { useEffect, useState } from 'react';
import { MemoriesRequestError, memoriesOrganizerApi } from '@/lib/memories/client/api';
import { memoriesShareCopy as copy } from '@/lib/memories/dashboard-copy';

interface Props {
	eventId: string;
	initialShareUrl: string | null;
}

/** Turns the read-only guest gallery link on, copies, rotates or revokes it. */
export default function MemoriesSharePanel({ eventId, initialShareUrl }: Props) {
	const [shareUrl, setShareUrl] = useState(initialShareUrl);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setShareUrl(initialShareUrl);
	}, [initialShareUrl]);

	const run = async (action: 'enable' | 'disable' | 'rotate') => {
		setBusy(true);
		setError(null);
		setNotice(null);
		try {
			const result = await memoriesOrganizerApi.share(eventId, action);
			setShareUrl(result.shareUrl);
		} catch (caught) {
			setError(
				caught instanceof MemoriesRequestError && caught.status === 503
					? copy.notConfigured
					: copy.error,
			);
		} finally {
			setBusy(false);
		}
	};

	const copyUrl = async () => {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			setNotice(copy.copied);
		} catch {
			setNotice(shareUrl);
		}
	};

	return (
		<div
			className="memories-host-summary__card memories-share"
			aria-labelledby="memories-share-title"
		>
			<h2 id="memories-share-title">{copy.title}</h2>
			{shareUrl ? (
				<>
					<p>{copy.onBody}</p>
					<div className="memories-share__url">
						<span>{shareUrl}</span>
					</div>
					<div className="memories-share__actions">
						<button
							type="button"
							className="btn-secondary"
							disabled={busy}
							onClick={() => void copyUrl()}
						>
							{copy.copy}
						</button>
						<a className="btn-secondary" href={shareUrl} target="_blank" rel="noopener">
							{copy.open}
						</a>
						<button
							type="button"
							className="btn-secondary"
							disabled={busy}
							title={copy.rotateHint}
							onClick={() => void run('rotate')}
						>
							{copy.rotate}
						</button>
						<button
							type="button"
							className="btn-secondary"
							disabled={busy}
							onClick={() => void run('disable')}
						>
							{copy.disable}
						</button>
					</div>
					<p className="memories-share__hint">{copy.rotateHint}</p>
				</>
			) : (
				<>
					<p>{copy.offBody}</p>
					<button
						type="button"
						className="btn-primary"
						disabled={busy}
						onClick={() => void run('enable')}
					>
						{copy.enable}
					</button>
				</>
			)}
			{notice ? (
				<p className="memories-share__hint" role="status">
					{notice}
				</p>
			) : null}
			{error ? (
				<p className="memories-notice memories-notice--danger" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
