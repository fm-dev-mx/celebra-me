import React from 'react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { getVisibleTags } from '@/lib/guests/guest-tags';
import {
	formatGuestDateShort,
	formatGuestEntrySource,
	formatPhoneDisplay,
	getDeliveryStateLabel,
	normalizeViewPercentage,
} from '@/components/dashboard/guests/guest-presenter';

interface GuestDetailGroupsProps {
	item: DashboardGuestItem;
}

const GuestDetailGroups: React.FC<GuestDetailGroupsProps> = ({ item }) => {
	const visibleTags = getVisibleTags(item.tags);
	const hasTags = visibleTags.length > 0;
	const viewPercentage = normalizeViewPercentage(item.viewPercentage);
	const hasActivity =
		item.firstViewedAt || item.respondedAt || item.isViewed || viewPercentage > 0;

	return (
		<div className="guest-detail-groups">
			<section className="guest-detail-group">
				<h4 className="guest-detail-group__title">Resumen</h4>
				<dl className="guest-detail-group__list">
					<div className="guest-detail-group__row">
						<dt className="guest-detail-group__label">Estado</dt>
						<dd className="guest-detail-group__value">{getDeliveryStateLabel(item)}</dd>
					</div>
					<div className="guest-detail-group__row">
						<dt className="guest-detail-group__label">Asistentes</dt>
						<dd className="guest-detail-group__value">
							{item.attendeeCount}/{item.maxAllowedAttendees}
						</dd>
					</div>
				</dl>
			</section>

			{hasActivity && (
				<section className="guest-detail-group">
					<h4 className="guest-detail-group__title">Actividad</h4>
					<dl className="guest-detail-group__list">
						{item.firstViewedAt && (
							<div className="guest-detail-group__row">
								<dt className="guest-detail-group__label">Visto</dt>
								<dd className="guest-detail-group__value">
									{formatGuestDateShort(item.firstViewedAt)}
								</dd>
							</div>
						)}
						{item.respondedAt && (
							<div className="guest-detail-group__row">
								<dt className="guest-detail-group__label">Respondió</dt>
								<dd className="guest-detail-group__value">
									{formatGuestDateShort(item.respondedAt)}
								</dd>
							</div>
						)}
						{viewPercentage > 0 && (
							<div className="guest-detail-group__row">
								<dt className="guest-detail-group__label">Interacción</dt>
								<dd className="guest-detail-group__value">{viewPercentage}%</dd>
							</div>
						)}
					</dl>
				</section>
			)}

			<section className="guest-detail-group">
				<h4 className="guest-detail-group__title">Origen</h4>
				<dl className="guest-detail-group__list">
					<div className="guest-detail-group__row">
						<dt className="guest-detail-group__label">Tipo</dt>
						<dd className="guest-detail-group__value">
							{formatGuestEntrySource(item)}
						</dd>
					</div>
					{hasTags && (
						<div className="guest-detail-group__row">
							<dt className="guest-detail-group__label">Grupo</dt>
							<dd className="guest-detail-group__value">
								{visibleTags.map((tag) => (
									<span key={tag} className="guest-tag guest-tag--group">
										{tag}
									</span>
								))}
							</dd>
						</div>
					)}
					{item.phone && (
						<div className="guest-detail-group__row">
							<dt className="guest-detail-group__label">Teléfono</dt>
							<dd className="guest-detail-group__value guest-detail-group__value--phone">
								{formatPhoneDisplay(item.phone)}
							</dd>
						</div>
					)}
					{item.email && (
						<div className="guest-detail-group__row">
							<dt className="guest-detail-group__label">Email</dt>
							<dd className="guest-detail-group__value">{item.email}</dd>
						</div>
					)}
				</dl>
			</section>
		</div>
	);
};

export default GuestDetailGroups;
