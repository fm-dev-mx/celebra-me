import React from 'react';
import type { Customer } from '@/components/dashboard/commercial/LeadCandidatesList';
import {
	buildCustomerReferralLink,
	buildPastClientReferralWhatsAppMessage,
} from '@/lib/commercial/referrals';

export interface CustomerOriginValue {
	city: string;
	country: string;
	isPastClient: boolean;
}

export const EMPTY_CUSTOMER_ORIGIN: CustomerOriginValue = {
	city: '',
	country: 'MX',
	isPastClient: false,
};

export function buildCustomerOriginPayload(value: CustomerOriginValue) {
	return {
		city: value.city.trim() || undefined,
		country: value.country.trim().toUpperCase() || undefined,
		isPastClient: value.isPastClient || undefined,
	};
}

export const CustomerOriginFields: React.FC<{
	value: CustomerOriginValue;
	onChange: (value: CustomerOriginValue) => void;
}> = ({ value, onChange }) => (
	<>
		<div className="dashboard-form-field">
			<label htmlFor="cust-city">Ciudad</label>
			<input
				id="cust-city"
				value={value.city}
				onChange={(event) => onChange({ ...value, city: event.target.value })}
			/>
		</div>
		<div className="dashboard-form-field">
			<label htmlFor="cust-country">País (código de 2 letras)</label>
			<input
				id="cust-country"
				maxLength={2}
				value={value.country}
				onChange={(event) => onChange({ ...value, country: event.target.value })}
			/>
		</div>
		<div className="dashboard-form-field">
			<label htmlFor="cust-past-client">
				<input
					id="cust-past-client"
					type="checkbox"
					checked={value.isPastClient}
					onChange={(event) => onChange({ ...value, isPastClient: event.target.checked })}
				/>{' '}
				Cliente anterior (ya compró antes)
			</label>
		</div>
	</>
);

export interface OrderReferralValue {
	isPastSale: boolean;
	soldAt: string;
	referralCode: string;
	applyCredit: boolean;
}

export const EMPTY_ORDER_REFERRAL: OrderReferralValue = {
	isPastSale: false,
	soldAt: '',
	referralCode: '',
	applyCredit: true,
};

/** Past sales carry their real date and never a referral code or a credit. */
export function buildOrderReferralPayload(value: OrderReferralValue) {
	if (value.isPastSale) return { isPastSale: true, soldAt: value.soldAt };
	return {
		referralCode: value.referralCode.trim() || undefined,
		applyReferrerCredit: value.applyCredit,
	};
}

export const OrderReferralFields: React.FC<{
	value: OrderReferralValue;
	onChange: (value: OrderReferralValue) => void;
	referralCreditMxn: number;
}> = ({ value, onChange, referralCreditMxn }) => (
	<>
		<div className="dashboard-form-field">
			<label htmlFor="order-past-sale">
				<input
					id="order-past-sale"
					type="checkbox"
					checked={value.isPastSale}
					onChange={(event) => onChange({ ...value, isPastSale: event.target.checked })}
				/>{' '}
				Venta anterior (no se envía a Meta)
			</label>
		</div>
		{value.isPastSale ? (
			<div className="dashboard-form-field">
				<label htmlFor="order-sold-at">Fecha real de la venta *</label>
				<input
					id="order-sold-at"
					type="date"
					required
					value={value.soldAt}
					onChange={(event) => onChange({ ...value, soldAt: event.target.value })}
				/>
			</div>
		) : (
			<>
				<div className="dashboard-form-field">
					<label htmlFor="order-referral-code">Código de recomendación</label>
					<input
						id="order-referral-code"
						maxLength={16}
						value={value.referralCode}
						onChange={(event) =>
							onChange({ ...value, referralCode: event.target.value })
						}
					/>
					<p className="dashboard-form-help">
						Aplica 10 % de descuento a quien fue recomendado. Si el prospecto llegó con
						un enlace ?ref=, el código se toma solo.
					</p>
				</div>
				{referralCreditMxn > 0 && (
					<div className="dashboard-form-field">
						<label htmlFor="order-apply-credit">
							<input
								id="order-apply-credit"
								type="checkbox"
								checked={value.applyCredit}
								onChange={(event) =>
									onChange({ ...value, applyCredit: event.target.checked })
								}
							/>{' '}
							Usar saldo a favor (${referralCreditMxn} MXN)
						</label>
					</div>
				)}
			</>
		)}
	</>
);

export const CustomerReferralPanel: React.FC<{
	customer: Customer;
	onSuccess: (message: string) => void;
	onError: (message: string) => void;
}> = ({ customer, onSuccess, onError }) => {
	if (!customer.referralCode) return null;
	const referralCode = customer.referralCode;
	const copyMessage = async () => {
		const message = buildPastClientReferralWhatsAppMessage({
			customerName: customer.displayName,
			referralCode,
		});
		try {
			await navigator.clipboard.writeText(message);
			onSuccess('Mensaje de WhatsApp copiado. Péguelo en la conversación del cliente.');
		} catch {
			onError('No se pudo copiar el mensaje. Intente de nuevo.');
		}
	};
	return (
		<section className="crm-detail__section" aria-labelledby="customer-referral-title">
			<p className="sales-workspace__eyebrow">Recomendaciones</p>
			<h4 id="customer-referral-title">Enlace de recomendación</h4>
			<p className="order-meta">
				Código: <strong>{referralCode}</strong> | {buildCustomerReferralLink(referralCode)}
			</p>
			<p className="order-meta">Saldo a favor: ${customer.referralCreditMxn ?? 0} MXN</p>
			<div className="dashboard-actions">
				<button type="button" className="btn-secondary" onClick={() => void copyMessage()}>
					Copiar mensaje de WhatsApp
				</button>
				<a
					className="btn-text-clear"
					href="/api/dashboard/commercial/customers?export=meta-csv"
					download
				>
					Descargar lista de clientes para Meta (CSV)
				</a>
			</div>
		</section>
	);
};
