// src/core/interfaces/ui/components/input.interface.ts

import React from 'react';
import { InputType } from '@/core/types/ui/input.type';
/**
 * Input component props interface.
 */
export interface InputProps {
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
