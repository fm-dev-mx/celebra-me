// src/core/interfaces/ui/components/button.interface.ts

import { IconNames } from '@customTypes/ui/iconNames.type';

/**
 * BaseButton: interface to represent a button or CTA with
 * potential link, icon, and modal configuration.
 */
export interface BaseButton {
	/** Text displayed on the button */
	label: string;

	/** Optional URL if the button acts as a link */
	href?: string;

	/** Optional function executed on click */
	onClick?: () => void;

	/** Style variants (you can add as needed) */
	variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'whatsapp';

	/** Optional icon for the button */
	icon?: IconNames;

	/** Optional flag to disable the button */
	disabled?: boolean;
}
