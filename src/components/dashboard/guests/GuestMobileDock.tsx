import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRightIcon, UserGroupIcon } from '@/components/common/icons/ui';

interface GuestMobileDockProps {
	loading: boolean;
	hasPendingGenerated: boolean;
	status: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed';
	createDisabled?: boolean;
	onCreate: () => void;
	onOpenNextAction: () => void;
	onStatusChange: (status: 'all' | 'pending' | 'confirmed' | 'declined' | 'viewed') => void;
}

const GuestMobileDock: React.FC<GuestMobileDockProps> = ({
	loading,
	hasPendingGenerated,
	status,
	createDisabled = false,
	onCreate,
	onOpenNextAction,
	onStatusChange,
}) => {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted || typeof document === 'undefined') return null;

	return createPortal(
		<div className="dashboard-guests__mobile-dock">
			<button
				type="button"
				className="dock-item"
				onClick={onCreate}
				disabled={createDisabled}
				aria-label="Crear nuevo invitado"
			>
				<span className="dock-icon" aria-hidden="true">
					<UserGroupIcon size={18} />
				</span>
				<span className="dock-label">Nuevo</span>
			</button>

			<button
				type="button"
				className="dock-item dock-item--main"
				disabled={loading || !hasPendingGenerated}
				onClick={onOpenNextAction}
				aria-label="Abrir siguiente invitado pendiente"
			>
				<span className="dock-icon" aria-hidden="true">
					<ArrowRightIcon size={18} />
				</span>
				<span className="dock-label">Siguiente</span>
			</button>

			<div className="dock-item dock-item--filter">
				<select
					aria-label="Filtrar invitados por estado"
					value={status}
					onChange={(event) => onStatusChange(event.target.value as typeof status)}
				>
					<option value="all">Filtrar</option>
					<option value="pending">Pendientes</option>
					<option value="confirmed">Confirmados</option>
					<option value="declined">Declinados</option>
					<option value="viewed">Vistos</option>
				</select>
				<span className="dock-label">Estado</span>
			</div>
		</div>,
		document.body,
	);
};

export default GuestMobileDock;
