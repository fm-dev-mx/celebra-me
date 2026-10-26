import React, { useCallback, useEffect, useState } from 'react';
import { dashboardApi } from '@/lib/dashboard/api-client';

export interface InvitationDataInboxItem {
	orderId: string;
	orderNumber: string;
	customerId: string;
	customerName: string | null;
	customerPhoneE164: string | null;
	celebrantNames: string | null;
	lastSavedAt: string | null;
	firstReview: boolean;
}

/** Loads the inbox once and refreshes it on demand (after the owner reviews a form). */
export function useInvitationDataInbox() {
	const [items, setItems] = useState<InvitationDataInboxItem[]>([]);
	const refresh = useCallback(async () => {
		try {
			const response = await dashboardApi.get<{ data: InvitationDataInboxItem[] }>(
				'/api/dashboard/commercial/invitation-data',
			);
			if (response.ok) setItems(response.data.data);
		} catch {
			// The notice is a convenience; the order panel still shows each form's state.
		}
	}, []);
	useEffect(() => {
		void refresh();
	}, [refresh]);
	return { items, refresh };
}

interface InvitationDataInboxProps {
	items: InvitationDataInboxItem[];
	onOpen: (item: InvitationDataInboxItem) => void;
}

/** Owner notice: invitation data forms received or changed since their last review. */
const InvitationDataInbox: React.FC<InvitationDataInboxProps> = ({ items, onOpen }) => {
	if (items.length === 0) return null;
	return (
		<section className="invitation-data-inbox" aria-labelledby="invitation-data-inbox-title">
			<h4 id="invitation-data-inbox-title">
				Datos de invitación por revisar <span>{items.length}</span>
			</h4>
			<ul>
				{items.map((item) => (
					<li key={item.orderId}>
						<button type="button" className="crm-record" onClick={() => onOpen(item)}>
							<span className="crm-record__topline">
								<span className="crm-record__identity">
									<strong>{item.customerName || 'Cliente sin nombre'}</strong>
									<small>{item.orderNumber}</small>
								</span>
								<small className="crm-record__status">
									{item.firstReview ? 'Nuevos' : 'Con cambios'}
								</small>
							</span>
							<span className="crm-record__context">
								{item.celebrantNames || 'Sin nombre del festejado'}
								{item.lastSavedAt
									? ` · ${new Date(item.lastSavedAt).toLocaleString('es-MX', {
											dateStyle: 'medium',
											timeStyle: 'short',
										})}`
									: ''}
							</span>
						</button>
					</li>
				))}
			</ul>
		</section>
	);
};

export default InvitationDataInbox;
