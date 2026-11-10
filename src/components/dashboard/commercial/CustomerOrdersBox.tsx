import React from 'react';
import InvitationDataPanel from '@/components/dashboard/commercial/InvitationDataPanel';
import { labelCommercialEventType } from '@/lib/tracking/commercial-presentation';

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
	isPastSale?: boolean;
	soldAt?: string | null;
	referralCodeUsed?: string | null;
	discountAmount?: number;
	referrerCreditAwarded?: number;
	referrerCreditRedeemed?: number;
}

interface CustomerOrdersBoxProps {
	customerOrders: SalesOrder[];
	depositAmounts: Record<string, string>;
	onAmountChange: (orderId: string, value: string) => void;
	markingDepositPaid: Record<string, boolean>;
	onMarkDepositPaid: (orderId: string) => void;
	/** Order whose deposit was just registered: its invitation data link is issued right away. */
	autoIssueInvitationDataOrderId?: string | null;
	onInvitationDataReviewed?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
	confirmed: 'Confirmado',
	quoted: 'Cotizado',
	deposit_paid: 'Anticipo pagado',
	paid: 'Totalmente pagado',
	draft: 'Borrador',
	cancelled: 'Cancelado',
	lost: 'Perdido',
};

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat('es-MX', {
		style: 'currency',
		currency: 'MXN',
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount);
}

function balanceClassName(hasInconsistentAmounts: boolean, balanceDue: number): string {
	if (hasInconsistentAmounts) return 'order-balance-inconsistent';
	return balanceDue > 0 ? 'order-balance-due' : 'order-balance-zero';
}

/** Past-sale and referral reward lines shown under an order's description. */
const OrderReferralNotes: React.FC<{ order: SalesOrder }> = ({ order }) => {
	const discountAmount = order.discountAmount ?? 0;
	const creditRedeemed = order.referrerCreditRedeemed ?? 0;
	const creditAwarded = order.referrerCreditAwarded ?? 0;
	const soldOn = order.soldAt ? ` del ${new Date(order.soldAt).toLocaleDateString('es-MX')}` : '';
	return (
		<>
			{order.isPastSale && (
				<p className="order-meta">Venta anterior{soldOn}: no se envía a Meta.</p>
			)}
			{discountAmount > 0 && (
				<p className="order-meta">
					Descuento aplicado: {formatCurrency(discountAmount)}
					{order.referralCodeUsed ? ` (recomendación ${order.referralCodeUsed})` : ''}
					{creditRedeemed > 0
						? ` | Saldo a favor usado: ${formatCurrency(creditRedeemed)}`
						: ''}
				</p>
			)}
			{creditAwarded > 0 && (
				<p className="order-meta">
					Saldo a favor otorgado a quien recomendó: {formatCurrency(creditAwarded)}
				</p>
			)}
		</>
	);
};

/** Deposit capture for an order that has not received its deposit yet. */
const DepositTrigger: React.FC<{
	order: SalesOrder;
	value: string | number;
	busy: boolean;
	onAmountChange: (orderId: string, value: string) => void;
	onMarkDepositPaid: (orderId: string) => void;
}> = ({ order, value, busy, onAmountChange, onMarkDepositPaid }) => {
	const amount = typeof value === 'string' ? parseFloat(value) : value;
	const valid = Number.isFinite(amount) && amount > 0;
	return (
		<div className="order-payment-trigger">
			<div className="order-payment-input-wrap">
				<label className="order-payment-label" htmlFor={`deposit-received-${order.id}`}>
					Anticipo recibido ($ MXN)
				</label>
				<input
					id={`deposit-received-${order.id}`}
					type="number"
					min="1"
					aria-describedby={`deposit-received-help-${order.id}`}
					value={value}
					onChange={(e) => onAmountChange(order.id, e.target.value)}
				/>
				<small id={`deposit-received-help-${order.id}`}>
					Monto que el cliente ya pagó. Se precarga con el anticipo sugerido; corríjalo si
					pagó otra cantidad.
				</small>
			</div>
			<button
				type="button"
				className="btn-primary"
				disabled={busy || !valid}
				aria-describedby={valid ? undefined : `deposit-disabled-reason-${order.id}`}
				onClick={() => onMarkDepositPaid(order.id)}
			>
				{busy ? 'Registrando...' : 'Registrar anticipo'}
			</button>
			{!valid && (
				<small id={`deposit-disabled-reason-${order.id}`}>
					Capture un anticipo recibido mayor a $0 para poder registrarlo.
				</small>
			)}
		</div>
	);
};

const CustomerOrdersBox: React.FC<CustomerOrdersBoxProps> = ({
	customerOrders,
	depositAmounts,
	onAmountChange,
	markingDepositPaid,
	onMarkDepositPaid,
	autoIssueInvitationDataOrderId = null,
	onInvitationDataReviewed,
}) => {
	if (customerOrders.length === 0) {
		return (
			<p className="dashboard-form-help">Este cliente aún no tiene órdenes registradas.</p>
		);
	}

	return (
		<div className="orders-list">
			{customerOrders.map((ord) => {
				const rawBalance = ord.totalAmount - ord.amountPaid;
				const balanceDue = Math.max(0, rawBalance);
				const hasInconsistentAmounts = rawBalance < 0;
				return (
					<div
						key={ord.id}
						className={`order-item-box${hasInconsistentAmounts ? ' order-item-box--inconsistent' : ''}`}
					>
						<div className="order-item-header">
							<span className="order-number">{ord.orderNumber}</span>
							<span
								className={`status-badge-custom status-${ord.status.replace('_', '-')}`}
							>
								{STATUS_LABELS[ord.status] || ord.status}
							</span>
						</div>
						<p className="order-desc">
							Evento: {labelCommercialEventType(ord.eventType)}
							{ord.packageName ? ` | Paquete: ${ord.packageName}` : ''}
						</p>
						<OrderReferralNotes order={ord} />
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
									className={balanceClassName(hasInconsistentAmounts, balanceDue)}
								>
									{hasInconsistentAmounts
										? 'Por conciliar'
										: formatCurrency(balanceDue)}
								</strong>
							</div>
						</div>
						{hasInconsistentAmounts && (
							<p className="order-inconsistency" role="alert">
								Revisar montos: el pagado supera el total por{' '}
								<strong>{formatCurrency(Math.abs(rawBalance))}</strong>.
							</p>
						)}
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

						{(ord.status === 'deposit_paid' || ord.status === 'paid') && (
							<InvitationDataPanel
								orderId={ord.id}
								autoIssue={autoIssueInvitationDataOrderId === ord.id}
								onReviewed={onInvitationDataReviewed}
							/>
						)}

						{/* Mark Deposit Paid Action */}
						{(ord.status === 'confirmed' || ord.status === 'quoted') && (
							<DepositTrigger
								order={ord}
								value={depositAmounts[ord.id] ?? ord.depositAmount ?? ''}
								busy={!!markingDepositPaid[ord.id]}
								onAmountChange={onAmountChange}
								onMarkDepositPaid={onMarkDepositPaid}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
};
export default CustomerOrdersBox;
