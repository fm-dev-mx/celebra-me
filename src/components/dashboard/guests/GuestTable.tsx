import React from 'react';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import GuestListRow from '@/components/dashboard/guests/GuestListRow';
import type { GuestListView } from '@/components/dashboard/guests/use-guest-list-view';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	getGuestInviteUrl,
	groupGuestsByStatus,
	type GuestSaveCallback,
} from '@/components/dashboard/guests/guest-presenter';
import GuestTableRow from '@/components/dashboard/guests/GuestTableRow';
import type { ShareMessagesConfig } from '@/lib/rsvp/services/shared/share-message-defaults';
import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';

interface GuestTableProps {
	items: DashboardGuestItem[];
	inviteBaseUrl: string;
	eventTitle: string;
	shareTemplates: ShareMessagesConfig;
	shareDateContext: ShareMessageDateContext;
	celebratingGuestId?: string | null;
	highlightedGuestId?: string | null;
	expandedGuestId?: string | null;
	reminderMode?: boolean;
	eligibleGuestIds?: Set<string>;
	onReminderSent?: (guestId: string) => void;
	onToggleExpanded?: (guestId: string) => void;
	onEdit: (item: DashboardGuestItem) => void;
	onDelete: (item: DashboardGuestItem) => Promise<void>;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onRevertShared?: (item: DashboardGuestItem) => Promise<void>;
	isBrandingRemovalEligible?: boolean;
	onToggleBrandingRemoval?: (guestId: string, hideCelebraMeBranding: boolean) => void;
	onSaveGuest?: GuestSaveCallback;
	/** Compact-screen presentation; the desktop table is unaffected. */
	view?: GuestListView;
	/** Opens the full-screen guest detail; when absent, compact rows expand in place. */
	onOpenDetails?: (item: DashboardGuestItem) => void;
}

export const GUEST_TABLE_COL_COUNT = 7;

const GuestTable: React.FC<GuestTableProps> = ({
	items,
	inviteBaseUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
	celebratingGuestId,
	highlightedGuestId,
	expandedGuestId,
	reminderMode,
	eligibleGuestIds,
	onReminderSent,
	onToggleExpanded,
	onEdit,
	onDelete,
	onMarkShared,
	onRevertShared,
	isBrandingRemovalEligible,
	onToggleBrandingRemoval,
	onSaveGuest,
	view = 'cards',
	onOpenDetails,
}) => {
	if (items.length === 0) {
		return (
			<div className="dashboard-guests__empty">
				<p>No hay invitados que coincidan con los filtros seleccionados.</p>
			</div>
		);
	}

	const renderCard = (item: DashboardGuestItem, index: number) => (
		<GuestCard
			key={item.guestId}
			item={item}
			index={index}
			inviteUrl={getGuestInviteUrl(item, inviteBaseUrl)}
			eventTitle={eventTitle}
			shareTemplates={shareTemplates}
			shareDateContext={shareDateContext}
			isCelebrating={celebratingGuestId === item.guestId}
			isHighlighted={highlightedGuestId === item.guestId}
			isExpanded={expandedGuestId === item.guestId}
			reminderMode={reminderMode}
			isReminderEligible={eligibleGuestIds?.has(item.guestId) ?? false}
			onReminderSent={onReminderSent}
			onToggleExpanded={() => onToggleExpanded?.(item.guestId)}
			onEdit={onEdit}
			onDelete={onDelete}
			onMarkShared={onMarkShared}
			onRevertShared={onRevertShared}
			isBrandingRemovalEligible={isBrandingRemovalEligible}
			onToggleBrandingRemoval={onToggleBrandingRemoval}
			onSaveGuest={onSaveGuest}
			onOpenDetails={onOpenDetails}
		/>
	);

	return (
		<>
			{view === 'list' ? (
				<div className="dashboard-guests__list">
					{groupGuestsByStatus(items).map((section) => {
						const headingId = `guest-section-${section.bucket}`;
						return (
							<section
								key={section.bucket}
								className={`guest-list-section guest-list-section--${section.bucket}`}
								aria-labelledby={headingId}
							>
								<h2 id={headingId} className="guest-list-section__title">
									<span>{section.title}</span>
									<span className="guest-list-section__count">
										{section.items.length}
									</span>
								</h2>
								<ul className="guest-list-section__items">
									{section.items.map((item) => {
										const isOpen =
											!onOpenDetails && expandedGuestId === item.guestId;
										const detailsId = onOpenDetails
											? undefined
											: `guest-row-details-${item.guestId}`;
										return (
											<li
												key={item.guestId}
												className="guest-list-section__item"
											>
												<GuestListRow
													item={item}
													isOpen={isOpen}
													detailsId={detailsId}
													onOpen={() =>
														onOpenDetails
															? onOpenDetails(item)
															: onToggleExpanded?.(item.guestId)
													}
												/>
												{isOpen && (
													<div
														id={detailsId}
														className="guest-row__details"
													>
														{renderCard(item, items.indexOf(item))}
													</div>
												)}
											</li>
										);
									})}
								</ul>
							</section>
						);
					})}
				</div>
			) : (
				<div className="dashboard-guests__cards">{items.map(renderCard)}</div>
			)}

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
								eventTitle={eventTitle}
								shareTemplates={shareTemplates}
								shareDateContext={shareDateContext}
								celebratingGuestId={celebratingGuestId}
								highlightedGuestId={highlightedGuestId}
								isExpanded={expandedGuestId === item.guestId}
								reminderMode={reminderMode}
								isReminderEligible={eligibleGuestIds?.has(item.guestId) ?? false}
								onReminderSent={onReminderSent}
								onToggleExpanded={() => onToggleExpanded?.(item.guestId)}
								onEdit={onEdit}
								onDelete={onDelete}
								onMarkShared={onMarkShared}
								onRevertShared={onRevertShared}
								isBrandingRemovalEligible={isBrandingRemovalEligible}
								onToggleBrandingRemoval={onToggleBrandingRemoval}
								onSaveGuest={onSaveGuest}
							/>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
};

export default GuestTable;
