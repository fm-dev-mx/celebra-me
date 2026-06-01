import type { FC } from 'react';
import ModalShell from '@/components/dashboard/ModalShell';

interface Props {
	title: string;
	message: string;
	confirmLabel: string;
	destructive?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
	loading?: boolean;
}

const ConfirmModal: FC<Props> = ({
	title,
	message,
	confirmLabel,
	destructive,
	onConfirm,
	onCancel,
	loading,
}) => {
	return (
		<ModalShell title={title} onClose={onCancel}>
			<div className="confirm-modal__body">
				<p className="confirm-modal__message">{message}</p>
			</div>
			<div className="confirm-modal__actions">
				<button
					type="button"
					className="btn-secondary"
					onClick={onCancel}
					disabled={loading}
				>
					Cancelar
				</button>
				<button
					type="button"
					className={`btn-primary${destructive ? ' btn-primary--danger' : ''}`}
					onClick={onConfirm}
					disabled={loading}
				>
					{loading ? 'Procesando...' : confirmLabel}
				</button>
			</div>
		</ModalShell>
	);
};

export default ConfirmModal;
