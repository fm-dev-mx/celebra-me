// src/core/types/ui/action.types.ts

import React from 'react';
import { ElementType } from '@/core/types/ui/component.type';

/**
 * Base variants used for styling and behavior purposes.
 */
export type BaseActionVariants = 'primary' | 'secondary' | 'text' | 'scroll' | 'large' | 'whatsapp';

/**
 * Variants for external links.
 * Example: 'external-primary', 'external-secondary'.
 */
export type ExternalVariants = `external-${BaseActionVariants}`;

/**
 * Variants for actions that include an icon.
 * Example: 'icon-primary', 'icon-secondary'.
 */
export type IconVariants = `icon-${BaseActionVariants}`;

/**
 * Union type combining all possible action variants.
 */
export type ActionVariants = BaseActionVariants | ExternalVariants | IconVariants;

/**
 * Predefined color options for actions.
 */
export type ActionColors = 'primary' | 'secondary' | 'accent' | 'neutral';

/**
 * Generic props for action components with flexibility for the `as` prop.
 *
 * @template T - Represents the type of the element (e.g., 'a', 'button', etc.).
 */
export type ActionBaseProps<T extends ElementType> = Omit<
	React.ComponentPropsWithRef<T>,
	'as' | 'color' | 'variant'
> & {
	variant?: ActionVariants; // Specifies the action's visual variant
	href?: string; // Used if the action is a link
	color?: ActionColors; // Defines the color scheme for the action
	as?: T; // Specifies the element type for rendering
	target?: string; // Target attribute for links
	rel?: string; // Relational attribute for links (e.g., "noopener noreferrer")
	className?: string; // Custom class names for styling
	children?: React.ReactNode; // Child elements to render inside the action
};
