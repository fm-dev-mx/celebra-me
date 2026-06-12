import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from '@/components/common/icons/ui';
import { EditGlyph, DeleteGlyph } from '@/components/dashboard/guests/GuestGlyphs';
import { useClipboard } from '@/hooks/use-clipboard';
type ConfirmState = 'idle' | 'confirm-mark-sent' | 'confirm-revert';

interface GuestExpandedActionsProps {
	guestName: string;
	inviteUrl: string;
	isShared: boolean;
	hideCopyLink?: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onMarkShared: () => void | Promise<void>;
	onRevertShared?: () => void | Promise<void>;
	guestId?: string;
	hideCelebraMeBranding?: boolean;
	isBrandingRemovalEligible?: boolean;
	onToggleBrandingRemoval?: (guestId: string, hideCelebraMeBranding: boolean) => void;
}

const GuestExpandedActions: React.FC<GuestExpandedActionsProps> = ({
	guestName,
	inviteUrl,
	isShared,
	hideCopyLink = false,
	onEdit,
	onDelete,
	onMarkShared,
	onRevertShared,
	guestId,
	hideCelebraMeBranding = false,
	isBrandingRemovalEligible,
	onToggleBrandingRemoval,
}) => {
	const { copied, copy: copyLink } = useClipboard();
	const [busy, setBusy] = useState(false);
	const [confirmState, setConfirmState] = useState<ConfirmState>('idle');

	const resetConfirm = () => setConfirmState('idle');

	const handleConfirmAction = async (
		targetState: ConfirmState,
		action: () => void | Promise<void>,
	) => {
		if (busy) return;

		if (confirmState !== targetState) {
			setConfirmState(targetState);
			return;
		}

		setBusy(true);

		try {
			await action();
			resetConfirm();
		} catch (error) {
			console.error(error);
		} finally {
			setBusy(false);
		}
	};

	const markSentLabel =
		confirmState === 'confirm-mark-sent'
			? 'Click para confirmar'
			: busy
				? 'Enviando…'
				: 'Marcar como enviada';

	const revertLabel =
		confirmState === 'confirm-revert'
			? 'Click para confirmar'
			: busy
				? 'Revirtiendo…'
				: 'Marcar como no enviada';
	const canToggleBranding = isBrandingRemovalEligible && guestId && !!onToggleBrandingRemoval;
	const brandingLabel = hideCelebraMeBranding ? 'Mostrar creador' : 'Ocultar creador';

	return (
		<div
			className="guest-expanded-actions"
			role="group"
			aria-label={`Acciones para ${guestName}`}
		>
			<div className="guest-expanded-actions__row guest-expanded-actions__row--safe">
				{!hideCopyLink && (
					<button
						type="button"
						className="btn-icon guest-expanded-actions__btn guest-expanded-actions__btn--copy"
						onClick={() => copyLink(inviteUrl)}
						title="Copiar enlace de invitación"
						aria-label={`Copiar enlace de invitación de ${guestName}`}
					>
						{copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
						<span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
					</button>
				)}

				<button
					type="button"
					className="btn-icon guest-expanded-actions__btn guest-expanded-actions__btn--edit"
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
			</div>

			<div className="guest-expanded-actions__row guest-expanded-actions__row--admin">
				{isShared ? (
					<button
						type="button"
						className={`btn-icon guest-expanded-actions__btn ${confirmState === 'confirm-revert' ? 'guest-expanded-actions__btn--confirm' : 'guest-expanded-actions__btn--revert'}`}
						onClick={() => {
							if (onRevertShared)
								handleConfirmAction('confirm-revert', onRevertShared);
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
						className={`btn-icon guest-expanded-actions__btn ${confirmState === 'confirm-mark-sent' ? 'guest-expanded-actions__btn--confirm' : 'guest-expanded-actions__btn--mark-sent'}`}
						onClick={() => handleConfirmAction('confirm-mark-sent', onMarkShared)}
						disabled={busy}
						title="Marcar como enviado"
						aria-label={`Marcar invitación de ${guestName} como enviada`}
					>
						<CheckIcon size={14} />
						<span>{markSentLabel}</span>
					</button>
				)}

				{canToggleBranding && (
					<button
						type="button"
						className="btn-icon guest-expanded-actions__btn guest-expanded-actions__btn--branding"
						onClick={() => {
							resetConfirm();
							onToggleBrandingRemoval(guestId, !hideCelebraMeBranding);
						}}
						title={brandingLabel}
						aria-label={`${brandingLabel} para ${guestName}`}
					>
						<span>{brandingLabel}</span>
					</button>
				)}

				<button
					type="button"
					className="btn-icon guest-expanded-actions__btn guest-expanded-actions__btn--delete"
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
		</div>
	);
};

export default GuestExpandedActions;
