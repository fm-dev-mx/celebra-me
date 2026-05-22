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
	expandedGuestId?: string | null;
	onToggleExpanded?: (guestId: string) => void;
	onEdit: (item: DashboardGuestItem) => void;
	onDelete: (item: DashboardGuestItem) => Promise<void>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
}

export const GUEST_TABLE_COL_COUNT = 7;

const GuestTable: React.FC<GuestTableProps> = ({
	items,
	inviteBaseUrl,
	celebratingGuestId,
	highlightedGuestId,
	expandedGuestId,
	onToggleExpanded,
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
						isExpanded={expandedGuestId === item.guestId}
						onToggleExpanded={() => onToggleExpanded?.(item.guestId)}
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
							<th>Nombre / Teléfono</th>
							<th>Nota</th>
							<th>Estado</th>
							<th>Asistentes</th>
							<th>% Vista</th>
							<th>Enviar</th>
							<th>
								<span className="sr-only">Ver más</span>
							</th>
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
								isExpanded={expandedGuestId === item.guestId}
								onToggleExpanded={() => onToggleExpanded?.(item.guestId)}
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
