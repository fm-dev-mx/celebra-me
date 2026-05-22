import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from '@/components/common/icons/ui';
import { EditGlyph, DeleteGlyph } from '@/components/dashboard/guests/GuestGlyphs';

interface GuestExpandedActionsProps {
	guestName: string;
	inviteUrl: string;
	isShared: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onMarkShared: () => Promise<void>;
}

const GuestExpandedActions: React.FC<GuestExpandedActionsProps> = ({
	guestName,
	inviteUrl,
	isShared,
	onEdit,
	onDelete,
	onMarkShared,
}) => {
	const [copied, setCopied] = useState(false);
	const [marking, setMarking] = useState(false);

	const handleCopyLink = async () => {
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleMarkShared = async () => {
		if (marking) return;
		setMarking(true);
		try {
			await onMarkShared();
		} finally {
			setMarking(false);
		}
	};

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

			{!isShared && (
				<button
					type="button"
					className="guest-expanded-actions__btn guest-expanded-actions__btn--mark-sent"
					onClick={handleMarkShared}
					disabled={marking}
					title="Marcar como enviado"
					aria-label={`Marcar invitación de ${guestName} como enviada`}
				>
					<CheckIcon size={14} />
					<span>{marking ? 'Enviando…' : 'Marcar como enviado'}</span>
				</button>
			)}

			<button
				type="button"
				className="guest-expanded-actions__btn guest-expanded-actions__btn--edit"
				onClick={onEdit}
				title="Editar invitado"
				aria-label={`Editar ${guestName}`}
			>
				<EditGlyph size={14} />
				<span>Editar</span>
			</button>

			<button
				type="button"
				className="guest-expanded-actions__btn guest-expanded-actions__btn--delete"
				onClick={onDelete}
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
