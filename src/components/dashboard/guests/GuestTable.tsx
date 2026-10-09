import React from 'react';
import GuestCard from '@/components/dashboard/guests/GuestCard';
import GuestListRow from '@/components/dashboard/guests/GuestListRow';
import GuestSelectRow from '@/components/dashboard/guests/GuestSelectRow';
import type { GuestListView } from '@/components/dashboard/guests/use-guest-list-view';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import {
	getGuestInviteUrl,
	groupGuestsByStatus,
	type GuestSaveCallback,
} from '@/components/dashboard/guests/guest-presenter';
import GuestTableRow from '@/components/dashboard/guests/GuestTableRow';
import { useMediaQuery } from '@/hooks/use-media-query';
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
	/** Guest whose details are open; the desktop row stays marked while the panel is open. */
	selectedGuestId?: string | null;
	reminderMode?: boolean;
	eligibleGuestIds?: Set<string>;
	onReminderSent?: (guestId: string) => void;
	onMarkShared: (item: DashboardGuestItem) => Promise<void>;
	onSaveGuest?: GuestSaveCallback;
	/** Compact-screen presentation; the desktop table is unaffected. */
	view?: GuestListView;
	/** Opens the guest detail: full screen on phones, side panel on desktop. */
	onOpenDetails: (item: DashboardGuestItem) => void;
	/** Selection mode: compact rows become checkboxes and the list view is forced. */
	selection?: {
		selectedIds: ReadonlySet<string>;
		onToggle: (guestId: string) => void;
	};
}

export const GUEST_TABLE_COL_COUNT = 5;

/** Matches the SCSS `xl` breakpoint where the table replaces the compact list. */
const DESKTOP_TABLE_QUERY = '(min-width: 1200px)';

const GuestTable: React.FC<GuestTableProps> = ({
	items,
	inviteBaseUrl,
	eventTitle,
	shareTemplates,
	shareDateContext,
	celebratingGuestId,
	highlightedGuestId,
	selectedGuestId,
	reminderMode,
	eligibleGuestIds,
	onReminderSent,
	onMarkShared,
	onSaveGuest,
	view = 'cards',
	onOpenDetails,
	selection,
}) => {
	// null until hydrated: both layouts render and CSS picks one. Afterwards only
	// the visible layout mounts, which halves the DOM for long guest lists.
	const isDesktop = useMediaQuery(DESKTOP_TABLE_QUERY);
	const showCompact = isDesktop !== true;
	const showTable = isDesktop !== false;

	if (items.length === 0) return null;

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
			reminderMode={reminderMode}
			isReminderEligible={eligibleGuestIds?.has(item.guestId) ?? false}
			onReminderSent={onReminderSent}
			onMarkShared={onMarkShared}
			onSaveGuest={onSaveGuest}
			onOpenDetails={onOpenDetails}
		/>
	);

	return (
		<>
			{showCompact && (view === 'list' || selection) ? (
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
									{section.items.map((item) => (
										<li key={item.guestId} className="guest-list-section__item">
											{selection ? (
												<GuestSelectRow
													item={item}
													selected={selection.selectedIds.has(
														item.guestId,
													)}
													onToggle={selection.onToggle}
												/>
											) : (
												<GuestListRow
													item={item}
													inviteUrl={getGuestInviteUrl(
														item,
														inviteBaseUrl,
													)}
													onOpen={onOpenDetails}
												/>
											)}
										</li>
									))}
								</ul>
							</section>
						);
					})}
				</div>
			) : (
				showCompact && (
					<div className="dashboard-guests__cards">{items.map(renderCard)}</div>
				)
			)}

			{showTable && (
				<div className="dashboard-guests__table-wrap">
					<table className="dashboard-guests__table">
						<thead>
							<tr>
								<th scope="col">Invitación</th>
								<th scope="col">Estado</th>
								<th scope="col">Personas</th>
								<th scope="col">Acciones</th>
								<th scope="col">
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
									isSelected={selectedGuestId === item.guestId}
									reminderMode={reminderMode}
									isReminderEligible={
										eligibleGuestIds?.has(item.guestId) ?? false
									}
									onReminderSent={onReminderSent}
									onOpenDetails={onOpenDetails}
									onMarkShared={onMarkShared}
									onSaveGuest={onSaveGuest}
								/>
							))}
						</tbody>
					</table>
				</div>
			)}
		</>
	);
};

export default GuestTable;
