// src/core/interfaces/ui/components/button.interface.ts

import type { IconNames } from '@/core/types/ui/iconNames.type';

export interface ButtonProps {
	/**
	 * Text displayed on the button.
	 */
	label: string;

	/**
	 * The type of the button (e.g., button, submit, reset).
	 */
	type?: 'button' | 'submit' | 'reset';

	/**
	 * Determines if the button is disabled.
	 */
	disabled?: boolean;

	/**
	 * The variant of the button (e.g., primary, secondary, outline).
	 */
	variant?: 'primary' | 'secondary' | 'outline' | 'text' | 'icon';

	/**
	 * Optional size of the button (e.g., small, medium, large).
	 */
	size?: 'small' | 'medium' | 'large';

	/**
	 * Determines if the button has a full width layout.
	 */
	fullWidth?: boolean;

	/**
	 * The name of the icon to display in the button (optional).
	 */
	icon?: IconNames;

	/**
	 * Position of the icon relative to the label.
	 */
	iconPosition?: 'left' | 'right' | 'top';

	/**
	 * The URL to navigate to if the button is rendered as a link.
	 */
	href?: string;

	/**
	 * Additional CSS classes for custom styling.
	 */
	extraClass?: string;

	/**
	 * Function to handle click events.
	 */
	onClick?: (event: MouseEvent) => void;
}
