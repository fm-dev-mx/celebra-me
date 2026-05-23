import React from 'react';
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE } from '@/lib/phone/country-codes';
import { parsePhoneInput } from '@/lib/phone/validation';

interface PhoneInputGroupProps {
	id?: string;
	countryCode: string;
	phone: string;
	onCountryCodeChange: (value: string) => void;
	onPhoneChange: (value: string) => void;
	error?: string | null;
	disabled?: boolean;
	label?: string;
	showOptional?: boolean;
	inputRef?: React.RefObject<HTMLInputElement | null>;
}

const PhoneInputGroup: React.FC<PhoneInputGroupProps> = ({
	id,
	countryCode,
	phone,
	onCountryCodeChange,
	onPhoneChange,
	error,
	disabled = false,
	label,
	showOptional = false,
	inputRef,
}) => {
	const inputId = id ? `${id}-phone` : 'phone-input';
	const selectId = id ? `${id}-country` : 'phone-country';

	const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
		const pasted = e.clipboardData.getData('text');
		if (!pasted.startsWith('+')) return;

		e.preventDefault();
		const result = parsePhoneInput(pasted);
		if (result.ok) {
			onCountryCodeChange(result.countryCode);
			onPhoneChange(result.phone);
		} else {
			onPhoneChange(pasted.replace(/[^\d+]/g, ''));
		}
	};

	return (
		<div>
			{label && (
				<label htmlFor={inputId} className="phone-input-group__label">
					{label}
					{showOptional && <span className="field-optional"> opcional</span>}
				</label>
			)}
			<div className={`phone-input-group${error ? ' phone-input-group--error' : ''}`}>
				<select
					id={selectId}
					className="phone-prefix"
					value={countryCode || DEFAULT_COUNTRY_CODE}
					onChange={(e) => onCountryCodeChange(e.target.value)}
					disabled={disabled}
					aria-label="Código de país"
				>
					{COUNTRY_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
				<input
					id={inputId}
					ref={inputRef}
					className="phone-number"
					type="tel"
					inputMode="numeric"
					autoComplete="tel"
					value={phone}
					onChange={(e) => onPhoneChange(e.target.value)}
					onPaste={handlePaste}
					disabled={disabled}
					placeholder="Número de teléfono"
					aria-label={label || 'Teléfono'}
				/>
			</div>
			{error && <span className="guest-field-error">{error}</span>}
		</div>
	);
};

export default PhoneInputGroup;
