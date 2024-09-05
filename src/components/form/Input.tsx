import React from 'react';

interface InputProps {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  name: string;
  required?: boolean;
  onInput: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const Input: React.FC<InputProps> = ({
  label,
  type,
  placeholder,
  value,
  name,
  required = false,
  onInput,
}) => (
  <div className="flex flex-col ">
    <label className="mb-2 font-medium text-gray-700 w-full">{label}</label>
    <input
      className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 w-full"
      type={type}
      placeholder={placeholder}
      value={value}
      name={name}
      required={required}
      onChange={onInput}
    />
  </div>
);

export default Input;
