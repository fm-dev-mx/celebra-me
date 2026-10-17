import { useId, useState } from 'react';
import { memoriesCaptureCopy as copy } from '@/lib/memories/copy';

/** Shows a just-issued recovery code once; the server keeps only its hash. */
export default function MemoriesRecoveryCodeCard({
	recoveryCode,
}: {
	recoveryCode: string | null;
}) {
	const titleId = useId();
	const [copied, setCopied] = useState(false);
	if (!recoveryCode) return null;
	const copyCode = async () => {
		if (!navigator.clipboard) return;
		try {
			await navigator.clipboard.writeText(recoveryCode);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};
	return (
		<aside className="status-page__recovery-code" aria-labelledby={titleId}>
			<strong id={titleId}>{copy.recoveryCodeTitle}</strong>
			<span>{copy.recoveryCodeHint}</span>
			<code tabIndex={0}>{recoveryCode}</code>
			<button type="button" onClick={() => void copyCode()}>
				{copied ? copy.recoveryCodeCopied : copy.copyRecoveryCode}
			</button>
			<small>{copy.recoveryCodeManualHint}</small>
		</aside>
	);
}
