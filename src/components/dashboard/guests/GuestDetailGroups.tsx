import React from 'react';
import type { DashboardGuestItem } from '@/interfaces/dashboard/guest.interface';
import { getVisibleTags } from '@/lib/guests/guest-tags';
import {
	formatGuestDateShort,
	formatGuestEntrySource,
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

	return (
		<div className="guest-detail-groups">
			<section className="guest-detail-group">
				<h4 className="guest-detail-group__title">Resumen</h4>
				<p className="guest-detail-group__content">
					<span className="guest-detail-group__value">{getDeliveryStateLabel(item)}</span>
					<span className="guest-detail-group__sep">·</span>
					<span className="guest-detail-group__value">
						{item.attendeeCount}/{item.maxAllowedAttendees} asistentes
					</span>
				</p>
			</section>

			{(item.firstViewedAt || item.respondedAt || item.isViewed) && (
				<section className="guest-detail-group">
					<h4 className="guest-detail-group__title">Actividad</h4>
					<p className="guest-detail-group__content">
						{item.firstViewedAt && (
							<span className="guest-detail-group__value">
								Visto {formatGuestDateShort(item.firstViewedAt)}
							</span>
						)}
						{item.respondedAt && (
							<>
								{item.firstViewedAt && (
									<span className="guest-detail-group__sep">·</span>
								)}
								<span className="guest-detail-group__value">
									Respondió {formatGuestDateShort(item.respondedAt)}
								</span>
							</>
						)}
						{(item.firstViewedAt || item.respondedAt) && (
							<span className="guest-detail-group__sep">·</span>
						)}
						<span className="guest-detail-group__value">Vista {viewPercentage}%</span>
					</p>
				</section>
			)}

			<section className="guest-detail-group">
				<h4 className="guest-detail-group__title">Origen</h4>
				<p className="guest-detail-group__content">
					<span className="guest-detail-group__value">
						{formatGuestEntrySource(item)}
					</span>
					{hasTags && (
						<>
							<span className="guest-detail-group__sep">·</span>
							{visibleTags.map((tag) => (
								<span key={tag} className="guest-tag guest-tag--group">
									{tag}
								</span>
							))}
						</>
					)}
					{item.phone && (
						<>
							<span className="guest-detail-group__sep">·</span>
							<span className="guest-detail-group__value">{item.phone}</span>
						</>
					)}
					{item.email && (
						<>
							<span className="guest-detail-group__sep">·</span>
							<span className="guest-detail-group__value">{item.email}</span>
						</>
					)}
				</p>
			</section>
		</div>
	);
};

export default GuestDetailGroups;
