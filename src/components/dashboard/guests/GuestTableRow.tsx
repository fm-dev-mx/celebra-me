import React from 'react';
import GuestActionsMenu from '@/components/dashboard/guests/GuestActionsMenu';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getGuestStatusLabel,
	getGuestStatusClass,
	getGuestVisibleTags,
} from '@/components/dashboard/guests/guest-presenter';
import { MessageIcon } from '@/components/common/icons/ui';

interface GuestTableRowProps {
	item: DashboardGuestItem;
	index: number;
	inviteUrl: string;
	celebratingGuestId?: string | null;
	highlightedGuestId?: string | null;
	onEdit: (item: DashboardGuestItem) => void;
	onDelete: (item: DashboardGuestItem) => Promise<void>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
}

const GuestTableRow: React.FC<GuestTableRowProps> = ({
	item,
	index,
	inviteUrl,
	celebratingGuestId,
	highlightedGuestId,
	onEdit,
	onDelete,
	onMarkShared,
}) => {
	const isViewed = item.firstViewedAt != null;
	const isShared = item.deliveryStatus === 'shared';
	const visibleTags = getGuestVisibleTags(item);

	return (
		<tr
			data-guest-id={item.guestId}
			className={`
				${item.deliveryStatus === 'shared' ? 'row-shared' : ''}
				${celebratingGuestId === item.guestId ? 'celebrate-success' : ''}
				${highlightedGuestId === item.guestId ? 'celebrate-success' : ''}
			`.trim()}
		>
			<td data-label="No.">
				<span className="invitation-number">#{String(index + 1).padStart(2, '0')}</span>
			</td>
			<td data-label="Nombre / Contacto">
				<div className="guest-info">
					<span className="guest-info__name">{item.fullName}</span>
					<span className="guest-info__phone">{item.phone}</span>
					{item.email && <span className="guest-info__email">{item.email}</span>}
					<span className="guest-tag guest-tag--subtle">
						{formatGuestEntrySource(item)}
					</span>
				</div>
			</td>
			<td data-label="Nota">
				{item.guestComment ? (
					<div className="guest-tooltip">
						<div className="guest-note-indicator guest-note-indicator--active">
							<MessageIcon size={20} />
						</div>
						<div className="guest-tooltip-content">{item.guestComment}</div>
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
						<span className="guest-tag guest-tag--subtle">Sin categoría</span>
					)}
				</div>
			</td>
			<td data-label="Estado">
				<div className={`status-pill status-pill--${getGuestStatusClass(item)}`}>
					<span className="status-pill__dot"></span>
					{getGuestStatusLabel(item)}
				</div>
			</td>
			<td data-label="Asistentes">
				<div className="attendee-count">
					<span className="attendee-count__current">{item.attendeeCount}</span>
					<span className="attendee-count__separator">/</span>
					<span className="attendee-count__max">{item.maxAllowedAttendees}</span>
				</div>
			</td>
			<td data-label="Entrega">
				<div className={`delivery-status delivery-status--${item.deliveryStatus}`}>
					{isShared ? <span>Enviada</span> : <span>Por enviar</span>}
				</div>
			</td>
			<td data-label="Progreso">
				<div className="engagement-mini" data-progress={item.viewPercentage}>
					<div className="engagement-mini__bar">
						<div className="engagement-mini__progress" />
					</div>
					<span className="engagement-mini__label">{item.viewPercentage}%</span>
				</div>
			</td>
			<td data-label="Pase">
				<div className={`view-status ${isViewed ? 'view-status--viewed' : ''}`}>
					{isViewed ? (
						<span title={`Visto: ${formatGuestDate(item.firstViewedAt)}`}>
							{formatGuestDate(item.firstViewedAt).split(',')[0]}
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
					<GuestActionsMenu
						guestName={item.fullName}
						inviteUrl={inviteUrl}
						onEdit={() => onEdit(item)}
						onDelete={() => onDelete(item)}
						onMarkShared={async () => onMarkShared(item)}
					/>
				</div>
			</td>
		</tr>
	);
};

export default GuestTableRow;
