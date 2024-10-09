// src/components/form/TextArea.tsx
import React from "react";

/**
 * TextArea component props interface.
 * @property {string} label - The text to display as the textarea label.
 * @property {string} [id] - The unique identifier for the textarea element.
 * @property {string} [className] - The class name to apply to the textarea element.
 * @property {string} placeholder - The text to display as the textarea placeholder.
 * @property {boolean} [required] - Whether the textarea is required or not.
 * @property {number} [rows] - The number of rows to display in the textarea.
 * @property {string} value - The current value of the textarea.
 * @property {(event: React.ChangeEvent<HTMLTextAreaElement>) => void} onChange - The function to call when the textarea value changes.
 * @property {(event: React.FocusEvent<HTMLTextAreaElement>) => void} [onBlur] - The function to call when the textarea loses focus.
 * @property {string} name - The name of the textarea element.
 * @property {string} [error] - The error message to display if the textarea is invalid.
 */
interface TextAreaProps {
	id?: string;
	label: string;
	className?: string;
	placeholder: string;
	required?: boolean;
	rows?: number;
	value: string;
	onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
	onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
	name: string;
	error?: string;
}

/**
 * Clase base para los estilos de inputs.
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
