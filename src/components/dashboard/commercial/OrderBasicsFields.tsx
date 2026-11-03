import React from 'react';
import { EVENT_TYPE_LABELS } from '@/lib/tracking/commercial-presentation';

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({
	value,
	label,
}));

export interface OrderBasicsValue {
	eventType: string;
	packageName: string;
	totalAmount: string;
	depositAmount: string;
}

export const EMPTY_ORDER_BASICS: OrderBasicsValue = {
	eventType: 'xv',
	packageName: '',
	totalAmount: '',
	depositAmount: '',
};

export const OrderBasicsFields: React.FC<{
	value: OrderBasicsValue;
	onChange: (value: OrderBasicsValue) => void;
}> = ({ value, onChange }) => (
	<>
		<div className="dashboard-form-field">
			<label htmlFor="order-event">Tipo de evento</label>
			<select
				id="order-event"
				value={value.eventType}
				onChange={(event) => onChange({ ...value, eventType: event.target.value })}
			>
				{EVENT_TYPE_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
		<div className="dashboard-form-field">
			<label htmlFor="order-package">Paquete</label>
			<input
				id="order-package"
				value={value.packageName}
				onChange={(event) => onChange({ ...value, packageName: event.target.value })}
			/>
		</div>
		<div className="dashboard-form-field">
			<label htmlFor="order-total">Monto total ($ MXN) *</label>
			<input
				id="order-total"
				type="number"
				required
				min="1"
				value={value.totalAmount}
				onChange={(event) => onChange({ ...value, totalAmount: event.target.value })}
			/>
		</div>
		<div className="dashboard-form-field">
			<label htmlFor="order-deposit">Anticipo sugerido ($ MXN)</label>
			<input
				id="order-deposit"
				type="number"
				min="0"
				value={value.depositAmount}
				onChange={(event) => onChange({ ...value, depositAmount: event.target.value })}
			/>
		</div>
	</>
);
