// src/frontend/components/form/Input.tsx
import React from "react";

/**
 * Valid input types for the Input component.
 * @type {InputType}
 */
export type InputType =
	| "text"
	| "email"
	| "password"
	| "tel"
	| "number"
	| "url"
	| "search"
	| "date"
	| "datetime-local"
	| "month"
	| "week"
	| "time"
	| "color";

/**
 * Input component props interface.
 */
interface InputProps {
	label: string;
	id: string; // Made 'id' required
	className?: string;
	type: InputType;
	placeholder: string;
	required?: boolean;
	value: string | undefined;
	onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
	name: string;
	error?: string;
}

/**
 * Input component.
 * It renders an input element with a label and an error message if the input is invalid.
 */
const Input: React.FC<InputProps> = ({
	id,
	label,
	className = "border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500",
	type,
	placeholder,
	required = false,
	value,
	onChange,
	onBlur,
	name,
	error,
}) => (
	<div className="flex flex-col">
		{/* Render the label and required indicator */}
		<label htmlFor={id} className="mb-2 font-medium text-gray-700 w-full">
			{label} {required && <span className="text-red-500">*</span>}
		</label>

		{/* Render the input element with the provided props */}
		<input
			id={id}
			className={className}
			type={type}
			placeholder={placeholder}
			required={required}
			value={value}
			onChange={onChange}
			onBlur={onBlur}
			name={name}
			aria-invalid={!!error}
			aria-describedby={error ? `${id}-error` : undefined}
		/>

		{/* Error message if input is invalid */}
		<div className="h-2">
			{error && (
				<p id={`${id}-error`} className="text-accent-dark ml-1 text-xs mt-1">
					{error}
				</p>
			)}
		</div>
	</div>
);

export default Input;
