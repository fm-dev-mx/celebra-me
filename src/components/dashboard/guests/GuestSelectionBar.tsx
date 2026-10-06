import React from 'react';
import { MessageGlyph, SentGlyph } from '@/components/dashboard/guests/GuestGlyphs';

interface GuestSelectionBarProps {
	selectedCount: number;
	totalCount: number;
	sendCount: number;
	remindCount: number;
	onSelectAll: () => void;
	onClearSelection: () => void;
	onSend: () => void;
	onRemind: () => void;
	onFinish: () => void;
}

/** Bottom bar shown in selection mode; actions only count guests they apply to. */
const GuestSelectionBar: React.FC<GuestSelectionBarProps> = ({
	selectedCount,
	totalCount,
	sendCount,
	remindCount,
	onSelectAll,
	onClearSelection,
	onSend,
	onRemind,
	onFinish,
}) => {
	const allSelected = selectedCount === totalCount && totalCount > 0;
	const nothingActionable = sendCount === 0 && remindCount === 0;

	return (
		<div className="guest-selection-bar" role="region" aria-label="Invitados seleccionados">
			<div className="guest-selection-bar__summary">
				<p className="guest-selection-bar__count" role="status">
					{selectedCount} de {totalCount} seleccionados
				</p>
				<div className="guest-selection-bar__links">
					<button
						type="button"
						className="guest-selection-bar__link"
						onClick={allSelected ? onClearSelection : onSelectAll}
					>
						{allSelected ? 'Quitar marcas' : 'Marcar todos'}
					</button>
					<button type="button" className="guest-selection-bar__link" onClick={onFinish}>
						Terminar
					</button>
				</div>
			</div>
			<div className="guest-selection-bar__actions">
				{sendCount > 0 && (
					<button type="button" className="btn-primary" onClick={onSend}>
						<SentGlyph size={20} />
						<span>Enviar invitación a {sendCount}</span>
					</button>
				)}
				{remindCount > 0 && (
					<button
						type="button"
						className={sendCount > 0 ? 'btn-secondary' : 'btn-primary'}
						onClick={onRemind}
					>
						<MessageGlyph size={20} />
						<span>Recordar a {remindCount}</span>
					</button>
				)}
				{nothingActionable && (
					<p className="guest-selection-bar__hint">
						{selectedCount === 0
							? 'Toque los invitados que quiera elegir.'
							: 'Los invitados elegidos ya respondieron.'}
					</p>
				)}
			</div>
		</div>
	);
};

export default GuestSelectionBar;
