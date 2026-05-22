import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from '@/components/common/icons/ui';
import { EditGlyph, DeleteGlyph } from '@/components/dashboard/guests/GuestGlyphs';

type ConfirmState = 'idle' | 'confirm-mark-sent' | 'confirm-revert';

interface GuestExpandedActionsProps {
	guestName: string;
	inviteUrl: string;
	isShared: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onMarkShared: () => Promise<void>;
	onRevertShared?: () => Promise<void>;
}

const GuestExpandedActions: React.FC<GuestExpandedActionsProps> = ({
	guestName,
	inviteUrl,
	isShared,
	onEdit,
	onDelete,
	onMarkShared,
	onRevertShared,
}) => {
	const [copied, setCopied] = useState(false);
	const [busy, setBusy] = useState(false);
	const [confirmState, setConfirmState] = useState<ConfirmState>('idle');

	const resetConfirm = () => setConfirmState('idle');

	const handleCopyLink = async () => {
		resetConfirm();
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleConfirmAction = (targetState: ConfirmState, action: () => Promise<void>) => {
		if (busy) return;
		if (confirmState === targetState) {
			resetConfirm();
			setBusy(true);
			action().finally(() => setBusy(false));
		} else {
			setConfirmState(targetState);
		}
	};

	const markSentLabel = (() => {
		if (confirmState === 'confirm-mark-sent') return 'Confirmar envío';
		if (busy) return 'Enviando…';
		return 'Marcar como enviado';
	})();

	const revertLabel = (() => {
		if (confirmState === 'confirm-revert') return 'Confirmar cambio';
		if (busy) return 'Revirtiendo…';
		return 'Marcar como no enviado';
	})();

	return (
		<div
			className="guest-expanded-actions"
			role="group"
			aria-label={`Acciones para ${guestName}`}
		>
			<button
				type="button"
				className="guest-expanded-actions__btn guest-expanded-actions__btn--copy"
				onClick={handleCopyLink}
				title="Copiar enlace de invitación"
				aria-label={`Copiar enlace de invitación de ${guestName}`}
			>
				{copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
				<span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
			</button>

			{isShared ? (
				<button
					type="button"
					className={`guest-expanded-actions__btn ${confirmState === 'confirm-revert' ? 'guest-expanded-actions__btn--confirm' : 'guest-expanded-actions__btn--revert'}`}
					onClick={() => {
						if (onRevertShared) handleConfirmAction('confirm-revert', onRevertShared);
					}}
					disabled={busy || !onRevertShared}
					title="Marcar como no enviado"
					aria-label={`Marcar invitación de ${guestName} como no enviada`}
				>
					<span>{revertLabel}</span>
				</button>
			) : (
				<button
					type="button"
					className={`guest-expanded-actions__btn ${confirmState === 'confirm-mark-sent' ? 'guest-expanded-actions__btn--confirm' : 'guest-expanded-actions__btn--mark-sent'}`}
					onClick={() => handleConfirmAction('confirm-mark-sent', onMarkShared)}
					disabled={busy}
					title="Marcar como enviado"
					aria-label={`Marcar invitación de ${guestName} como enviada`}
				>
					<CheckIcon size={14} />
					<span>{markSentLabel}</span>
				</button>
			)}

			<button
				type="button"
				className="guest-expanded-actions__btn guest-expanded-actions__btn--edit"
				onClick={() => {
					resetConfirm();
					onEdit();
				}}
				title="Editar invitado"
				aria-label={`Editar ${guestName}`}
			>
				<EditGlyph size={14} />
				<span>Editar</span>
			</button>

			<button
				type="button"
				className="guest-expanded-actions__btn guest-expanded-actions__btn--delete"
				onClick={() => {
					resetConfirm();
					onDelete();
				}}
				title="Eliminar invitado"
				aria-label={`Eliminar ${guestName}`}
			>
				<DeleteGlyph size={14} />
				<span>Eliminar</span>
			</button>
		</div>
	);
};

export default GuestExpandedActions;
