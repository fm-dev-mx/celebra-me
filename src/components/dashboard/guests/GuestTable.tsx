import React, { useEffect, useRef, useState } from 'react';
import { CopyIcon } from '@/components/common/icons/ui';
import { EditGlyph, DeleteGlyph, CheckGlyph } from '@/components/dashboard/guests/GuestGlyphs';
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
import { MessageIcon } from '@/components/common/icons/ui';

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
				<p>Sin invitados</p>
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
											<span className="guest-tag guest-tag--subtle">
												{formatGuestEntrySource(item)}
											</span>
										</div>
									</td>
									<td data-label="Nota">
										{item.guestComment ? (
											<div className="guest-tooltip">
												<div
													className={`guest-note-indicator ${item.guestComment ? 'guest-note-indicator--active' : ''}`}
												>
													<MessageIcon size={20} />
												</div>
												<div className="guest-tooltip-content">
													{item.guestComment}
												</div>
											</div>
										) : (
											<span className="guest-tag guest-tag--subtle">—</span>
										)}
									</td>
									<td data-label="Categoría">
										<div className="dashboard-guests__tags">
											{visibleTags.length > 0 ? (
												visibleTags.map((tag) => (
													<span key={tag} className="guest-tag">
														{tag}
													</span>
												))
											) : (
												<span className="guest-tag guest-tag--subtle">
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
												<span>Enviada</span>
											) : (
												<span>Por enviar</span>
											)}
										</div>
									</td>
									<td data-label="Progreso">
										<div
											className="engagement-mini"
											data-progress={item.viewPercentage}
										>
											<div className="engagement-mini__bar">
												<div className="engagement-mini__progress" />
											</div>
											<span className="engagement-mini__label">
												{item.viewPercentage}%
											</span>
										</div>
									</td>
									<td data-label="Pase">
										<div
											className={`view-status ${isViewed ? 'view-status--viewed' : ''}`}
										>
											{isViewed ? (
												<span
													title={`Visto: ${formatGuestDate(item.firstViewedAt)}`}
												>
													{
														formatGuestDate(item.firstViewedAt).split(
															',',
														)[0]
													}
												</span>
											) : (
												<span>No vista</span>
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
													<CheckGlyph size={16} />
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
												<EditGlyph size={16} />
											</button>
											<button
												type="button"
												className="btn-icon btn-icon--danger"
												title="Eliminar"
												aria-label={`Eliminar invitado ${item.fullName}`}
												onClick={() => onDelete(item)}
											>
												<DeleteGlyph size={16} />
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
