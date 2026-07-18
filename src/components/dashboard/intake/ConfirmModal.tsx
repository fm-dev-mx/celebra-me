import { useId, type FC } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';

interface Props {
	title: string;
	message: string;
	confirmLabel: string;
	destructive?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
	loading?: boolean;
	previewUrl?: string;
	summary?: string[];
	feedback?: Exclude<
		import('@/lib/intake/publication-feedback').PublicationFeedback,
		{ state: 'idle' }
	>;
	hideCancel?: boolean;
}

const ConfirmModal: FC<Props> = ({
	title,
	message,
	confirmLabel,
	destructive,
	onConfirm,
	onCancel,
	loading,
	previewUrl,
	summary,
	feedback,
	hideCancel = false,
}) => {
	const descriptionId = useId();
	return (
		<ModalShell
			title={title}
			onClose={onCancel}
			descriptionId={descriptionId}
			disableClose={loading}
			initialFocus="heading"
			variant="confirm"
		>
			<div className="confirm-modal__body">
				<p id={descriptionId} className="confirm-modal__message">
					{message}
				</p>
				{feedback && (
					<div
						className={`confirm-modal__feedback confirm-modal__feedback--${feedback.state}`}
						role={feedback.state === 'error' ? 'alert' : 'status'}
						aria-live={feedback.state === 'error' ? 'assertive' : 'polite'}
					>
						<p>{feedback.message}</p>
						{'guidance' in feedback && <p>{feedback.guidance}</p>}
					</div>
				)}
				{summary && summary.length > 0 && (
					<>
						<p>Cambios pendientes frente a la versión pública:</p>
						<ul>
							{summary.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</>
				)}
			</div>
			<div className="confirm-modal__actions">
				{previewUrl && (
					<a className="btn-secondary" href={previewUrl} target="_blank" rel="noreferrer">
						Vista previa
					</a>
				)}
				{!hideCancel && (
					<button
						type="button"
						className="btn-secondary"
						onClick={onCancel}
						disabled={loading}
					>
						Cancelar
					</button>
				)}
				<button
					type="button"
					className={`btn-primary${destructive ? ' btn-primary--danger' : ''}`}
					onClick={onConfirm}
					disabled={loading}
				>
					{loading
						? 'Procesando...'
						: feedback?.state === 'error' && feedback.retryable
							? 'Reintentar'
							: confirmLabel}
				</button>
			</div>
		</ModalShell>
	);
};

export default ConfirmModal;
