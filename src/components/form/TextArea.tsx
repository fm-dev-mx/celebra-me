import React from 'react';

interface TextAreaProps {
  label: string;
  placeholder: string;
  value: string;
  name: string;
  rows?: number;
  required?: boolean;
  onInput: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const TextArea: React.FC<TextAreaProps> = ({
  label,
  placeholder,
  value,
  name,
  rows = 5,
  required = false,
  onInput,
}) => (
  <div className="flex flex-col">
    <label className="mb-2 font-medium text-gray-700">{label}</label>
    <textarea
      className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500"
      placeholder={placeholder}
      value={value}
      name={name}
      rows={rows}
      required={required}
      onChange={onInput}
    />
  </div>
);

export default TextArea;
