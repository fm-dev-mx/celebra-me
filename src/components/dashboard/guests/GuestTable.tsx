import React, { useEffect, useRef, useState } from 'react';
import { CopyIcon } from '@/components/common/icons/ui';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getGuestAttendanceLabel,
	getGuestInviteUrl,
	getGuestVisibleTags,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestTableProps {
	items: DashboardGuestItem[];
	inviteBaseUrl: string;
	celebratingGuestId?: string | null;
	highlightedGuestId?: string | null;
	onEdit: (item: DashboardGuestItem) => void;
	onDelete: (item: DashboardGuestItem) => Promise<void>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
}

const EditGlyph = () => (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
	</svg>
);

const DeleteGlyph = () => (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M3 6h18" />
		<path d="M8 6V4h8v2" />
		<path d="M19 6l-1 14H6L5 6" />
		<path d="M10 11v6" />
		<path d="M14 11v6" />
	</svg>
);

const CheckGlyph = () => (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="m5 12 5 5L20 7" />
	</svg>
);

const GuestTable: React.FC<GuestTableProps> = ({
	items,
	inviteBaseUrl,
	celebratingGuestId,
	highlightedGuestId,
	onEdit,
	onDelete,
	onMarkShared,
}) => {
	const [copiedGuestId, setCopiedGuestId] = useState<string | null>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (copiedGuestId) {
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				setCopiedGuestId(null);
			}, 5000);
		}
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [copiedGuestId]);

	if (!items || items.length === 0) {
		return (
			<div className="dashboard-guests__empty">
				<p>No hay invitados registrados.</p>
			</div>
		);
	}

	const getInviteUrl = (item: DashboardGuestItem) => getGuestInviteUrl(item, inviteBaseUrl);

	return (
		<>
			<div className="dashboard-guests__cards">
				{items.map((item, index) => (
					<GuestCard
						key={item.guestId}
						item={item}
						index={index}
						inviteUrl={getInviteUrl(item)}
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
							<th>Categorías</th>
							<th>Estado</th>
							<th>Asistentes</th>
							<th>Entrega</th>
							<th>Apertura</th>
							<th>Acciones</th>
						</tr>
					</thead>
					<tbody>
						{items.map((item, index) => {
							const inviteUrl = getInviteUrl(item);
							const isViewed = !!item.firstViewedAt;
							const isShared = item.deliveryStatus === 'shared';
							const visibleTags = getGuestVisibleTags(item);

							return (
								<tr
									key={item.guestId}
									data-guest-id={item.guestId}
									className={`
										${copiedGuestId === item.guestId ? 'row-focus-highlight' : ''}
										${item.deliveryStatus === 'shared' ? 'row-shared' : ''}
										${celebratingGuestId === item.guestId ? 'celebrate-success' : ''}
										${highlightedGuestId === item.guestId ? 'celebrate-success' : ''}
									`.trim()}
								>
									<td data-label="No.">
										<span className="invitation-number">
											#{String(index + 1).padStart(2, '0')}
										</span>
									</td>
									<td data-label="Nombre / Contacto">
										<div className="guest-info">
											<span className="guest-info__name">
												{item.fullName}
											</span>
											<span className="guest-info__phone">{item.phone}</span>
											{item.email && (
												<span className="guest-info__email">
													{item.email}
												</span>
											)}
											<span className="tag">
												{formatGuestEntrySource(item)}
											</span>
										</div>
									</td>
									<td data-label="Categorías">
										<div className="dashboard-guests__tags">
											{visibleTags.length > 0 ? (
												visibleTags.map((tag) => (
													<span key={tag} className="tag">
														{tag}
													</span>
												))
											) : (
												<span className="tag tag--subtle">
													Sin categoría
												</span>
											)}
										</div>
									</td>
									<td data-label="Estado">
										<div
											className={`status-pill status-pill--${item.attendanceStatus}`}
										>
											<span className="status-pill__dot"></span>
											{getGuestAttendanceLabel(item.attendanceStatus)}
										</div>
									</td>
									<td data-label="Asistentes">
										<div className="attendee-count">
											<span className="attendee-count__current">
												{item.attendeeCount}
											</span>
											<span className="attendee-count__separator">/</span>
											<span className="attendee-count__max">
												{item.maxAllowedAttendees}
											</span>
										</div>
									</td>
									<td data-label="Entrega">
										<div
											className={`delivery-status delivery-status--${item.deliveryStatus}`}
										>
											{isShared ? (
												<span>Entregada</span>
											) : (
												<span>Por enviar</span>
											)}
										</div>
									</td>
									<td data-label="Apertura">
										<div
											className={`view-status ${isViewed ? 'view-status--viewed' : ''}`}
										>
											{isViewed ? (
												<span>
													{
														formatGuestDate(item.firstViewedAt).split(
															',',
														)[0]
													}
												</span>
											) : (
												<span>Sin apertura</span>
											)}
										</div>
									</td>
									<td data-label="Acciones">
										<div className="dashboard-guests__actions">
											<ShareAction
												phone={item.phone}
												waShareUrl={item.waShareUrl}
												inviteUrl={inviteUrl}
												shareText={item.shareText}
												onShared={async () => onMarkShared(item)}
											/>
											<button
												type="button"
												className={`btn-icon ${copiedGuestId === item.guestId ? 'btn-icon--active' : ''}`}
												title="Copiar enlace"
												aria-label={`Copiar enlace de invitación de ${item.fullName}`}
												onClick={async () => {
													await navigator.clipboard.writeText(inviteUrl);
													setCopiedGuestId(item.guestId);
												}}
											>
												{copiedGuestId === item.guestId ? (
													<CheckGlyph />
												) : (
													<CopyIcon size={16} />
												)}
											</button>
											{copiedGuestId === item.guestId && !isShared && (
												<button
													type="button"
													className="btn-accent btn-accent--small animate-pop-in"
													onClick={() => {
														void onMarkShared(item);
														setCopiedGuestId(null);
													}}
												>
													Registrar entrega
												</button>
											)}
											<button
												type="button"
												className="btn-icon"
												title="Editar"
												aria-label={`Editar invitado ${item.fullName}`}
												onClick={() => onEdit(item)}
											>
												<EditGlyph />
											</button>
											<button
												type="button"
												className="btn-icon btn-icon--danger"
												title="Eliminar"
												aria-label={`Eliminar invitado ${item.fullName}`}
												onClick={() => onDelete(item)}
											>
												<DeleteGlyph />
											</button>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</>
	);
};

export default GuestTable;
