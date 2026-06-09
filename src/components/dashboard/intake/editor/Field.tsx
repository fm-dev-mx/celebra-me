import type { ReactNode } from 'react';

interface Props {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: 'text' | 'email' | 'url' | 'date' | 'datetime-local' | 'time' | 'number';
	placeholder?: string;
	labelExtra?: ReactNode;
	maxLength?: number;
}

export default function Field({
	label,
	value,
	onChange,
	type = 'text',
	placeholder,
	labelExtra,
	maxLength,
}: Props) {
	return (
		<label className="invitation-editor__field">
			<span>
				{label}
				{labelExtra}
			</span>
			<input
				type={type}
				value={value}
				placeholder={placeholder}
				maxLength={maxLength}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	);
}
