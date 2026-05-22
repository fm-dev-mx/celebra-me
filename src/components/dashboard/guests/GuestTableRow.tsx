import React, { useLayoutEffect, useRef } from 'react';
import { ChevronDownIcon } from '@/components/common/icons/ui';
import GuestExpandedActions from '@/components/dashboard/guests/GuestExpandedActions';
import { GUEST_TABLE_COL_COUNT } from '@/components/dashboard/guests/GuestTable';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	formatGuestDate,
	formatGuestEntrySource,
	getPrimaryStatusLabel,
	getPrimaryStatusClass,
	getGuestVisibleTags,
	getDeliveryStateLabel,
	getRsvpStateLabel,
	getViewStateLabel,
	hasMessage,
} from '@/components/dashboard/guests/guest-presenter';
import { MessageIcon } from '@/components/common/icons/ui';

interface GuestTableRowProps {
	item: DashboardGuestItem;
	index: number;
	inviteUrl: string;
	celebratingGuestId?: string | null;
	highlightedGuestId?: string | null;
	isExpanded?: boolean;
	onToggleExpanded?: () => void;
	onEdit: (item: DashboardGuestItem) => void;
	onDelete: (item: DashboardGuestItem) => Promise<void>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onRevertShared?: (item: DashboardGuestItem) => Promise<void>;
}

const GuestTableRow: React.FC<GuestTableRowProps> = ({
	item,
	index,
	inviteUrl,
	celebratingGuestId,
	highlightedGuestId,
	isExpanded,
	onToggleExpanded,
	onEdit,
	onDelete,
	onMarkShared,
	onRevertShared,
}) => {
	const progressRef = useRef<HTMLDivElement>(null);
	const isViewed = item.firstViewedAt != null;

	useLayoutEffect(() => {
		if (progressRef.current) {
			progressRef.current.style.width = `${Math.round(item.viewPercentage)}%`;
		}
	}, [item.viewPercentage]);
	const isShared = item.deliveryStatus === 'shared';
	const visibleTags = getGuestVisibleTags(item);
	const hasTags = visibleTags.length > 0;
	const expandId = `row-details-${item.guestId}`;

	const rowClassName = [
		item.deliveryStatus === 'shared' ? 'row-shared' : '',
		celebratingGuestId === item.guestId ? 'celebrate-success' : '',
		highlightedGuestId === item.guestId ? 'celebrate-success' : '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<>
			<tr data-guest-id={item.guestId} className={rowClassName}>
				<td data-label="Nombre / Teléfono">
					<div className="guest-info">
						<span className="guest-info__name">
							<span className="invitation-number">
								#{String(index + 1).padStart(2, '0')}
							</span>
							{item.fullName}
						</span>
						<span className="guest-info__phone">{item.phone}</span>
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
				<td data-label="Estado">
					<div className={`status-pill status-pill--${getPrimaryStatusClass(item)}`}>
						<span className="status-pill__dot"></span>
						{getPrimaryStatusLabel(item)}
					</div>
				</td>
				<td data-label="Asistentes">
					<div className="attendee-count">
						<span className="attendee-count__current">{item.attendeeCount}</span>
						<span className="attendee-count__separator">/</span>
						<span className="attendee-count__max">{item.maxAllowedAttendees}</span>
					</div>
				</td>
				<td data-label="% Vista">
					<div className="engagement-mini" data-progress={item.viewPercentage}>
						<div className="engagement-mini__bar">
							<div ref={progressRef} className="engagement-mini__progress" />
						</div>
						<span className="engagement-mini__label">{item.viewPercentage}%</span>
					</div>
				</td>
				<td data-label="Enviar">
					<ShareAction
						phone={item.phone}
						waShareUrl={item.waShareUrl}
						inviteUrl={inviteUrl}
						shareText={item.shareText}
						onShared={async () => onMarkShared(item)}
					/>
				</td>
				<td data-label="">
					<button
						type="button"
						className={`guest-row__menu-btn ${isExpanded ? 'guest-row__menu-btn--open' : ''}`}
						title={isExpanded ? 'Ver menos detalles' : 'Ver más detalles'}
						aria-label={
							isExpanded
								? `Ver menos detalles de ${item.fullName}`
								: `Ver más detalles de ${item.fullName}`
						}
						aria-expanded={isExpanded}
						aria-controls={expandId}
						onClick={onToggleExpanded}
					>
						<ChevronDownIcon size={16} aria-hidden="true" />
					</button>
				</td>
			</tr>

			{isExpanded && (
				<tr
					className="guest-row__expanded-row"
					id={expandId}
					role="region"
					aria-label={`Detalles de ${item.fullName}`}
				>
					<td colSpan={GUEST_TABLE_COL_COUNT}>
						<div className="guest-row__expanded-inner">
							<div className="guest-row__expanded-grid">
								<div className="guest-row__detail">
									<span className="guest-row__detail-label">Entrega</span>
									<span className="guest-row__detail-value">
										{getDeliveryStateLabel(item)}
									</span>
								</div>

								<div className="guest-row__detail">
									<span className="guest-row__detail-label">RSVP</span>
									<span className="guest-row__detail-value">
										{getRsvpStateLabel(item)}
									</span>
								</div>

								<div className="guest-row__detail">
									<span className="guest-row__detail-label">Visualización</span>
									<span className="guest-row__detail-value">
										{getViewStateLabel(item)}
									</span>
								</div>

								{item.email && (
									<div className="guest-row__detail">
										<span className="guest-row__detail-label">Email</span>
										<span className="guest-row__detail-value">
											{item.email}
										</span>
									</div>
								)}

								<div className="guest-row__detail">
									<span className="guest-row__detail-label">Origen</span>
									<span className="guest-row__detail-value">
										{formatGuestEntrySource(item)}
									</span>
								</div>

								{hasTags && (
									<div className="guest-row__detail">
										<span className="guest-row__detail-label">Categoría</span>
										<div className="guest-row__detail-tags">
											{visibleTags.map((tag) => (
												<span key={tag} className="guest-tag">
													{tag}
												</span>
											))}
										</div>
									</div>
								)}

								{isViewed && (
									<div className="guest-row__detail">
										<span className="guest-row__detail-label">
											Última vista
										</span>
										<span
											className="guest-row__detail-value"
											title={formatGuestDate(item.firstViewedAt)}
										>
											{formatGuestDate(item.firstViewedAt).split(',')[0]}
										</span>
									</div>
								)}
							</div>

							{hasMessage(item) && (
								<div className="guest-row__expanded-message">
									<div className="guest-row__detail-label">
										Mensaje del invitado
									</div>
									<p className="guest-row__expanded-message-text">
										"{item.guestComment}"
									</p>
								</div>
							)}

							<div className="guest-row__expanded-actions">
								<GuestExpandedActions
									guestName={item.fullName}
									inviteUrl={inviteUrl}
									isShared={isShared}
									attendanceStatus={item.attendanceStatus}
									onEdit={() => onEdit(item)}
									onDelete={() => onDelete(item)}
									onMarkShared={async () => onMarkShared(item)}
									onRevertShared={
										onRevertShared
											? async () => onRevertShared(item)
											: undefined
									}
								/>
							</div>
						</div>
					</td>
				</tr>
			)}
		</>
	);
};

export default GuestTableRow;
