import type { ReactNode } from 'react';

interface Props {
	label: string;
	value: string;
	onChange: (value: string) => void;
	labelExtra?: ReactNode;
}

export default function TextArea({ label, value, onChange, labelExtra }: Props) {
	return (
		<label className="invitation-editor__field">
			<span>
				{label}
				{labelExtra}
			</span>
			<textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
		</label>
	);
}
