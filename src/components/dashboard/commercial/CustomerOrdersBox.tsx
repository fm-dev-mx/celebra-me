import React from 'react';

export interface SalesOrder {
	id: string;
	orderNumber: string;
	customerId: string;
	leadId?: string | null;
	status: 'draft' | 'quoted' | 'confirmed' | 'deposit_paid' | 'paid' | 'cancelled' | 'lost';
	eventType: string;
	packageName?: string | null;
	currency: string;
	totalAmount: number;
	depositAmount?: number | null;
	amountPaid: number;
	depositPaidAt?: string | null;
	paidAt?: string | null;
	created_at?: string;
}

interface CustomerOrdersBoxProps {
	customerOrders: SalesOrder[];
	depositAmounts: Record<string, string>;
	onAmountChange: (orderId: string, value: string) => void;
	markingDepositPaid: Record<string, boolean>;
	onMarkDepositPaid: (orderId: string) => void;
}

export const CustomerOrdersBox: React.FC<CustomerOrdersBoxProps> = ({
	customerOrders,
	depositAmounts,
	onAmountChange,
	markingDepositPaid,
	onMarkDepositPaid,
}) => {
	if (customerOrders.length === 0) {
		return <p className="dashboard-form-help">Este cliente aún no tiene órdenes registradas.</p>;
	}

	return (
		<div className="orders-list">
			{customerOrders.map((ord) => (
				<div key={ord.id} className="order-item-box">
					<div className="order-item-header">
						<span className="order-number">{ord.orderNumber}</span>
						<span className={`status-badge-custom status-${ord.status}`}>
							{ord.status === 'confirmed' ? 'Confirmado' :
							 ord.status === 'quoted' ? 'Cotizado' :
							 ord.status === 'deposit_paid' ? 'Anticipo Pagado' :
							 ord.status === 'paid' ? 'Totalmente Pagado' : ord.status}
						</span>
					</div>
					<p className="order-desc">
						Evento: {ord.eventType} {ord.packageName ? `| Paquete: ${ord.packageName}` : ''}
					</p>
					<p className="order-price">
						Total: <strong>${ord.totalAmount} MXN</strong> | Pagado: <strong>${ord.amountPaid} MXN</strong>
					</p>

					{/* Mark Deposit Paid Action */}
					{(ord.status === 'confirmed' || ord.status === 'quoted') && (
						<div className="order-payment-trigger">
							<input
								type="number"
								min="1"
								placeholder="Monto anticipo"
								value={depositAmounts[ord.id] || ord.depositAmount || ''}
								onChange={(e) => onAmountChange(ord.id, e.target.value)}
							/>
							<button
								type="button"
								className="btn-primary"
								disabled={markingDepositPaid[ord.id]}
								onClick={() => onMarkDepositPaid(ord.id)}
							>
								{markingDepositPaid[ord.id] ? 'Registrando...' : 'Registrar Anticipo'}
							</button>
						</div>
					)}
				</div>
			))}
		</div>
	);
};
export default CustomerOrdersBox;
