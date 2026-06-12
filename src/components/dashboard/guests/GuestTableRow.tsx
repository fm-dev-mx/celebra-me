import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDownIcon, MessageIcon } from '@/components/common/icons/ui';
import GuestDetailGroups from '@/components/dashboard/guests/GuestDetailGroups';
import GuestExpandedActions from '@/components/dashboard/guests/GuestExpandedActions';
import GuestMessageHistory from '@/components/dashboard/guests/GuestMessageHistory';
import { GUEST_TABLE_COL_COUNT } from '@/components/dashboard/guests/GuestTable';
import ShareAction from '@/components/dashboard/guests/ShareAction';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import {
	getPrimaryStatus,
	getCompactGroupChips,
	getGuestMessageCount,
	getGuestPrimaryAction,
	getGuestMessageFallbackTimestamp,
	normalizeViewPercentage,
	type GuestSaveCallback,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestTableRowProps {
	item: DashboardGuestItem;
	index: number;
	inviteUrl: string;
	eventTitle: string;
	shareTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	celebratingGuestId?: string | null;
	highlightedGuestId?: string | null;
	isExpanded?: boolean;
	onToggleExpanded?: () => void;
	onEdit: (item: DashboardGuestItem) => void;
	onDelete: (item: DashboardGuestItem) => Promise<void>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onRevertShared?: (item: DashboardGuestItem) => Promise<void>;
	isBrandingRemovalEligible?: boolean;
	onToggleBrandingRemoval?: (guestId: string, hideCelebraMeBranding: boolean) => void;
	onSaveGuest?: GuestSaveCallback;
}

const GuestTableRow: React.FC<GuestTableRowProps> = ({
	item,
	index,
	inviteUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
	celebratingGuestId,
	highlightedGuestId,
	isExpanded,
	onToggleExpanded,
	onEdit,
	onDelete,
	onMarkShared,
	onRevertShared,
	isBrandingRemovalEligible,
	onToggleBrandingRemoval,
	onSaveGuest,
}) => {
	const msgId = useId();
	const [msgOpen, setMsgOpen] = useState(false);
	const viewPercentage = normalizeViewPercentage(item.viewPercentage);
	const progressRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isExpanded) setMsgOpen(false);
	}, [isExpanded]);

	useLayoutEffect(() => {
		if (progressRef.current) {
			progressRef.current.style.setProperty('--progress-width', `${viewPercentage}%`);
		}
	}, [viewPercentage]);

	const { chips: compactChips, overflow: compactOverflow } = getCompactGroupChips(item, 1);
	const hasCompactChips = compactChips.length > 0;
	const status = getPrimaryStatus(item);
	const expandId = `row-details-${item.guestId}`;
	const hasMessages = getGuestMessageCount(item.guestComment) > 0;
	const primaryActionIsCopy = getGuestPrimaryAction(item).action === 'copy-link';

	const msgPanel = hasMessages && msgOpen && (
		<tr className="guest-message-row">
			<td colSpan={GUEST_TABLE_COL_COUNT}>
				<div
					className="guest-message-panel"
					id={msgId}
					role="region"
					aria-label="Mensajes del invitado"
				>
					<GuestMessageHistory
						guestComment={item.guestComment}
						fallbackTimestampIso={getGuestMessageFallbackTimestamp(item)}
					/>
				</div>
			</td>
		</tr>
	);

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
							<span className="guest-info__chips">
								{hasCompactChips &&
									compactChips.map((chip) => (
										<span key={chip} className="guest-tag guest-tag--group">
											{chip}
										</span>
									))}
								{compactOverflow > 0 && (
									<span className="guest-tag guest-tag--overflow">
										+{compactOverflow}
									</span>
								)}
							</span>
						</span>
						<span className="guest-info__phone">{item.phone}</span>
					</div>
				</td>
				<td data-label="Nota">
					{hasMessages ? (
						<button
							type="button"
							className="btn-accent guest-nota-btn"
							onClick={() => setMsgOpen((v) => !v)}
							aria-expanded={msgOpen}
							aria-controls={msgId}
						>
							<MessageIcon size={16} aria-hidden="true" />
							<span>{msgOpen ? 'Ocultar' : 'Ver mensaje'}</span>
						</button>
					) : (
						<span className="guest-tag guest-tag--subtle">—</span>
					)}
				</td>
				<td data-label="Estado">
					<div className={`status-pill status-pill--${status.class}`}>
						<span className="status-pill__dot"></span>
						{status.label}
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
					<div
						className="engagement-mini"
						role="progressbar"
						aria-valuenow={viewPercentage}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label={`Visualización de la invitación: ${viewPercentage}%`}
					>
						<div className="engagement-mini__bar">
							<div ref={progressRef} className="engagement-mini__progress" />
						</div>
						<span className="engagement-mini__label">{viewPercentage}%</span>
					</div>
				</td>
				<td data-label="Enviar">
					<ShareAction
						guest={item}
						inviteUrl={inviteUrl}
						eventTitle={eventTitle}
						shareTemplates={shareTemplates}
						shareDateContext={shareDateContext}
						onShared={async () => onMarkShared(item)}
						onSaveGuest={onSaveGuest}
					/>
				</td>
				<td data-label="">
					<button
						type="button"
						className={`btn-icon guest-row__menu-btn ${isExpanded ? 'guest-row__menu-btn--open' : ''}`}
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

			{msgPanel}

			{isExpanded && (
				<tr
					className="guest-row__expanded-row"
					id={expandId}
					role="region"
					aria-label={`Detalles de ${item.fullName}`}
				>
					<td colSpan={GUEST_TABLE_COL_COUNT}>
						<div className="guest-row__expanded-inner">
							{hasMessages && (
								<GuestMessageHistory
									guestComment={item.guestComment}
									fallbackTimestampIso={getGuestMessageFallbackTimestamp(item)}
								/>
							)}
							<GuestDetailGroups item={item} />
							<div className="guest-row__expanded-actions">
								<GuestExpandedActions
									guestName={item.fullName}
									inviteUrl={inviteUrl}
									isShared={item.deliveryStatus === 'shared'}
									hideCopyLink={primaryActionIsCopy}
									onEdit={() => onEdit(item)}
									onDelete={() => onDelete(item)}
									onMarkShared={async () => onMarkShared(item)}
									onRevertShared={
										onRevertShared
											? async () => onRevertShared(item)
											: undefined
									}
									guestId={item.guestId}
									hideCelebraMeBranding={item.hideCelebraMeBranding ?? false}
									isBrandingRemovalEligible={isBrandingRemovalEligible}
									onToggleBrandingRemoval={onToggleBrandingRemoval}
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
