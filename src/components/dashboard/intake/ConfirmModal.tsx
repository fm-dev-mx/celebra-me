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
	previewUrl?: string;
	summary?: string[];
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
}) => {
	return (
		<ModalShell title={title} onClose={onCancel}>
			<div className="confirm-modal__body">
				<p className="confirm-modal__message">{message}</p>
				{summary && summary.length > 0 && (
					<>
						<p>Secciones guardadas que se publicarán:</p>
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
