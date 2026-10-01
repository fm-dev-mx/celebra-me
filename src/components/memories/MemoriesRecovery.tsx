import { useId, useMemo, useState, type SyntheticEvent } from 'react';
import { MEMORIES_RECOVERY_CODE_LENGTH } from '@/lib/memories/contract/catalog';
import { buildMemoriesPublicPath } from '@/lib/memories/contract/private-request';
import { memoriesRecoveryFormCopy as copy } from '@/lib/memories/copy';
import { createMemoriesGuestApi } from '@/lib/memories/client/api';

type RecoveryStatus = 'idle' | 'submitting' | 'error';

type MemoriesRecoveryProps = {
	publicSlug: string;
	onRecovered?: () => void;
};

export default function MemoriesRecovery({ publicSlug, onRecovered }: MemoriesRecoveryProps) {
	const inputId = useId();
	const api = useMemo(() => createMemoriesGuestApi(publicSlug), [publicSlug]);
	const [recoveryCode, setRecoveryCode] = useState('');
	const [status, setStatus] = useState<RecoveryStatus>('idle');

	const recover = async (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!recoveryCode.trim() || status === 'submitting') return;
		setStatus('submitting');
		try {
			await api.recoverSession(recoveryCode.trim());
			setRecoveryCode('');
			if (onRecovered) onRecovered();
			else window.location.replace(`${buildMemoriesPublicPath(publicSlug)}#mis-recuerdos`);
		} catch {
			setStatus('error');
		}
	};

	return (
		<form className="status-page__recovery-form" onSubmit={recover} noValidate>
			<label htmlFor={inputId}>{copy.inputLabel}</label>
			<input
				id={inputId}
				name="recoveryCode"
				value={recoveryCode}
				maxLength={MEMORIES_RECOVERY_CODE_LENGTH}
				autoComplete="one-time-code"
				autoCapitalize="characters"
				spellCheck={false}
				required
				onChange={(event) => {
					setRecoveryCode(event.target.value.toUpperCase());
					if (status === 'error') setStatus('idle');
				}}
			/>
			<button
				type="submit"
				className="status-page__btn"
				disabled={!recoveryCode.trim() || status === 'submitting'}
			>
				{status === 'submitting' ? copy.submitting : copy.submit}
			</button>
			{status === 'error' ? (
				<p className="status-page__status status-page__status--error" role="alert">
					{copy.failed}
				</p>
			) : null}
		</form>
	);
}
