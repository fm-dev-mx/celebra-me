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
}

interface CustomerOrdersBoxProps {
	customerOrders: SalesOrder[];
	depositAmounts: Record<string, string>;
	onAmountChange: (orderId: string, value: string) => void;
	markingDepositPaid: Record<string, boolean>;
	onMarkDepositPaid: (orderId: string) => void;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
	xv: 'XV años',
	boda: 'Boda',
	bautizo: 'Bautizo',
	cumple: 'Cumpleaños',
	'baby-shower': 'Baby shower',
	'primera-comunion': 'Primera comunión',
};

const STATUS_LABELS: Record<string, string> = {
	confirmed: 'Confirmado',
	quoted: 'Cotizado',
	deposit_paid: 'Anticipo Pagado',
	paid: 'Totalmente Pagado',
	draft: 'Borrador',
	cancelled: 'Cancelado',
	lost: 'Perdido',
};

function formatEventType(slug: string): string {
	return EVENT_TYPE_LABELS[slug] || slug;
}

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat('es-MX', {
		style: 'currency',
		currency: 'MXN',
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount);
}

const CustomerOrdersBox: React.FC<CustomerOrdersBoxProps> = ({
	customerOrders,
	depositAmounts,
	onAmountChange,
	markingDepositPaid,
	onMarkDepositPaid,
}) => {
	if (customerOrders.length === 0) {
		return (
			<p className="dashboard-form-help">Este cliente aún no tiene órdenes registradas.</p>
		);
	}

	return (
		<div className="orders-list">
			{customerOrders.map((ord) => {
				const balanceDue = Math.max(0, ord.totalAmount - ord.amountPaid);
				return (
					<div key={ord.id} className="order-item-box">
						<div className="order-item-header">
							<span className="order-number">{ord.orderNumber}</span>
							<span
								className={`status-badge-custom status-${ord.status.replace('_', '-')}`}
							>
								{STATUS_LABELS[ord.status] || ord.status}
							</span>
						</div>
						<p className="order-desc">
							Evento: {formatEventType(ord.eventType)}
							{ord.packageName ? ` | Paquete: ${ord.packageName}` : ''}
						</p>
						<div className="order-price-row">
							<div className="order-amount">
								<span className="order-amount-label">Total:</span>
								<strong>{formatCurrency(ord.totalAmount)}</strong>
							</div>
							<div className="order-amount">
								<span className="order-amount-label">Pagado:</span>
								<strong>{formatCurrency(ord.amountPaid)}</strong>
							</div>
							<div className="order-amount">
								<span className="order-amount-label">Saldo:</span>
								<strong
									className={
										balanceDue > 0 ? 'order-balance-due' : 'order-balance-zero'
									}
								>
									{formatCurrency(balanceDue)}
								</strong>
							</div>
						</div>
						{ord.status === 'deposit_paid' && ord.depositPaidAt && (
							<p className="order-meta">
								Anticipo pagado el:{' '}
								{new Date(ord.depositPaidAt).toLocaleString('es-MX')}
							</p>
						)}
						{ord.status === 'paid' && ord.paidAt && (
							<p className="order-meta">
								Pagado el: {new Date(ord.paidAt).toLocaleString('es-MX')}
							</p>
						)}

						{/* Mark Deposit Paid Action */}
						{(ord.status === 'confirmed' || ord.status === 'quoted') && (
							<div className="order-payment-trigger">
								<div className="order-payment-input-wrap">
									<label className="order-payment-label">
										Anticipo recibido ($ MXN)
									</label>
									<input
										type="number"
										min="1"
										placeholder="899"
										value={depositAmounts[ord.id] ?? ord.depositAmount ?? ''}
										onChange={(e) => onAmountChange(ord.id, e.target.value)}
									/>
								</div>
								<button
									type="button"
									className="btn-primary"
									disabled={
										markingDepositPaid[ord.id] ||
										(() => {
											const raw =
												depositAmounts[ord.id] ?? ord.depositAmount ?? '';
											const num =
												typeof raw === 'string' ? parseFloat(raw) : raw;
											return !(Number.isFinite(num) && num > 0);
										})()
									}
									onClick={() => onMarkDepositPaid(ord.id)}
								>
									{markingDepositPaid[ord.id]
										? 'Registrando...'
										: 'Registrar Anticipo'}
								</button>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
};
export default CustomerOrdersBox;
