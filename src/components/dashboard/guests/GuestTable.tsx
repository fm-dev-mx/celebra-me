import React from 'react';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { getGuestInviteUrl } from '@/components/dashboard/guests/guest-presenter';
import GuestTableRow from '@/components/dashboard/guests/GuestTableRow';

interface GuestTableProps {
	items: DashboardGuestItem[];
	inviteBaseUrl: string;
	celebratingGuestId?: string | null;
	highlightedGuestId?: string | null;
	onEdit: (item: DashboardGuestItem) => void;
	onDelete: (item: DashboardGuestItem) => Promise<void>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
}

const GuestTable: React.FC<GuestTableProps> = ({
	items,
	inviteBaseUrl,
	celebratingGuestId,
	highlightedGuestId,
	onEdit,
	onDelete,
	onMarkShared,
}) => {
	if (!items || items.length === 0) {
		return (
			<div className="dashboard-guests__empty">
				<p>No hay invitados que coincidan con los filtros seleccionados.</p>
			</div>
		);
	}

	return (
		<>
			<div className="dashboard-guests__cards">
				{items.map((item, index) => (
					<GuestCard
						key={item.guestId}
						item={item}
						index={index}
						inviteUrl={getGuestInviteUrl(item, inviteBaseUrl)}
						isCelebrating={celebratingGuestId === item.guestId}
						isHighlighted={highlightedGuestId === item.guestId}
						onEdit={onEdit}
						onDelete={onDelete}
						onMarkShared={onMarkShared}
					/>
				))}
			</div>

			<div className="dashboard-guests__table-wrap">
				<table className="dashboard-guests__table">
					<thead>
						<tr>
							<th>No.</th>
							<th>Nombre / Contacto</th>
							<th>Nota</th>
							<th>Categoría</th>
							<th>Estado</th>
							<th>Asistentes</th>
							<th>Entrega</th>
							<th>Progreso</th>
							<th>Pase</th>
							<th>Acciones</th>
						</tr>
					</thead>
					<tbody>
						{items.map((item, index) => (
							<GuestTableRow
								key={item.guestId}
								item={item}
								index={index}
								inviteUrl={getGuestInviteUrl(item, inviteBaseUrl)}
								celebratingGuestId={celebratingGuestId}
								highlightedGuestId={highlightedGuestId}
								onEdit={onEdit}
								onDelete={onDelete}
								onMarkShared={onMarkShared}
							/>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
};

export default GuestTable;
