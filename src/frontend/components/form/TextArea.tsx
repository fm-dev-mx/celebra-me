// src/frontend/components/form/TextArea.tsx
import React from "react";

/**
 * TextArea component props interface.
 */
interface TextAreaProps {
	id: string; // Made 'id' required
	label: string;
	className?: string;
	placeholder: string;
	required?: boolean;
	rows?: number;
	value: string | undefined;
	onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
	onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
	name: string;
	error?: string;
}

/**
 * Base styles for the input.
 */
const baseInputClasses =
	"border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500";

/**
 * TextArea component.
 * It renders a textarea element with a label and an error message if the textarea is invalid.
 */
const TextArea: React.FC<TextAreaProps> = ({
	id,
	label,
	className = baseInputClasses,
	placeholder,
	required = false,
	rows = 5,
	value,
	onChange,
	onBlur,
	name,
	error,
}) => (
	<div className="flex flex-col">
		<label htmlFor={id} className="mb-2 font-medium text-gray-700">
			{label} {required && <span className="text-red-500">*</span>}
		</label>
		<textarea
			id={id}
			className={className}
			placeholder={placeholder}
			required={required}
			rows={rows}
			value={value}
			onChange={onChange}
			onBlur={onBlur}
			name={name}
			aria-invalid={!!error}
			aria-describedby={error ? `${id}-error` : undefined}
		/>

		{/* Render the error message if it exists */}
		<div className="h-4">
			{error && (
				<p id={`${id}-error`} className="text-accent-dark ml-1 text-xs mt-1">
					{error}
				</p>
			)}
		</div>
	</div>
);

export default TextArea;
