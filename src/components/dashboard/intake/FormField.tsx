import type { ValidationError } from '@/lib/intake/validation/validate-draft-content';

interface Props {
	section: string;
	fieldKey: string;
	label: string;
	value: string;
	onChange: (v: string) => void;
	type?: 'text' | 'textarea';
	rows?: number;
	errors: ValidationError[];
}

export default function FormField({
	section,
	fieldKey,
	label,
	value,
	onChange,
	type = 'text',
	rows,
	errors,
}: Props) {
	const sectionErrors = errors.filter((e) => e.section === section);
	const fieldError = sectionErrors.find((e) => e.field === fieldKey);

	return (
		<div className={`intake-editor__field${fieldError ? ' intake-editor__field--error' : ''}`}>
			<label className="intake-field__label">{label}</label>
			{type === 'textarea' ? (
				<textarea
					className="intake-field__textarea"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					rows={rows ?? 2}
				/>
			) : (
				<input
					className="intake-field__input"
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value)}
				/>
			)}
			{fieldError && <p className="intake-field__error">{fieldError.message}</p>}
		</div>
	);
}
