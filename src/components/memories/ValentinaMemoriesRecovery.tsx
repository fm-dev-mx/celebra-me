import { useId, useState, type SyntheticEvent } from 'react';
import { VALENTINA_MEMORIES_RECOVERY_CODE_LENGTH } from '@/data/valentina-memories-media.contract';
import {
	VALENTINA_MEMORIES_ROUTE_PATH,
	valentinaMemoriesRecoveryPageCopy,
} from '@/data/valentina-memories.data';
import { recoverValentinaMemoriesSession } from '@/lib/memories/valentina-memories-session-client';

type RecoveryStatus = 'idle' | 'submitting' | 'error';

type ValentinaMemoriesRecoveryProps = {
	onRecovered?: () => void;
};

export default function ValentinaMemoriesRecovery({
	onRecovered = () => window.location.replace(`${VALENTINA_MEMORIES_ROUTE_PATH}#mis-recuerdos`),
}: ValentinaMemoriesRecoveryProps) {
	const inputId = useId();
	const copy = valentinaMemoriesRecoveryPageCopy;
	const [recoveryCode, setRecoveryCode] = useState('');
	const [status, setStatus] = useState<RecoveryStatus>('idle');

	const recover = async (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!recoveryCode.trim() || status === 'submitting') return;
		setStatus('submitting');
		try {
			await recoverValentinaMemoriesSession(recoveryCode.trim());
			setRecoveryCode('');
			onRecovered();
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
				maxLength={VALENTINA_MEMORIES_RECOVERY_CODE_LENGTH}
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
