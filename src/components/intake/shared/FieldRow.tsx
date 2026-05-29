import type { FC } from 'react';

interface FieldRowProps {
	label: string;
	value: unknown;
}

export function formatValue(value: unknown): string | null {
	if (value === '' || value === undefined || value === null) return null;
	if (typeof value === 'boolean') return value ? 'Sí' : 'No';
	return String(value);
}

export const FieldRow: FC<FieldRowProps> = ({ label, value }) => {
	const display = formatValue(value);
	if (display === null) return null;
	return (
		<div className="intake-review__field">
			<dt className="intake-review__key">{label}</dt>
			<dd className="intake-review__value">{display}</dd>
		</div>
	);
};
