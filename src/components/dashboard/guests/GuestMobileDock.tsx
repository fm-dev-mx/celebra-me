import React from 'react';
import { createPortal } from 'react-dom';

interface GuestMobileDockProps {
	loading: boolean;
	hasPendingGenerated: boolean;
	status: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed';
	onCreate: () => void;
	onOpenNextAction: () => void;
	onStatusChange: (status: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed') => void;
}

const GuestMobileDock: React.FC<GuestMobileDockProps> = ({
	loading,
	hasPendingGenerated,
	status,
	onCreate,
	onOpenNextAction,
	onStatusChange,
}) => {
	if (typeof document === 'undefined') return null;

	return createPortal(
		<div className="dashboard-guests__mobile-dock">
			<button type="button" className="dock-item" onClick={onCreate}>
				<span className="dock-icon">➕</span>
				<span className="dock-label">Nuevo</span>
			</button>

			<button
				type="button"
				className="dock-item dock-item--main"
				disabled={loading || !hasPendingGenerated}
				onClick={onOpenNextAction}
			>
				<span className="dock-icon">🚀</span>
				<span className="dock-label">Siguiente</span>
			</button>

			<div className="dock-item dock-item--filter">
				<select
					aria-label="Filtrar invitados por estado"
					value={status}
					onChange={(event) => onStatusChange(event.target.value as typeof status)}
				>
					<option value="all">Filtrar</option>
					<option value="pending">⏳ Pend.</option>
					<option value="confirmed">✅ Conf.</option>
					<option value="declined">❌ Decl.</option>
				</select>
				<span className="dock-label">Estado</span>
			</div>
		</div>,
		document.body,
	);
};

export default GuestMobileDock;
