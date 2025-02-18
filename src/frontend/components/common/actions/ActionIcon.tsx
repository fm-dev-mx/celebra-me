// src/components/common/actions/ActionIcon.tsx

import React from 'react';
import ActionBase from './ActionBase';
import {
	ActionVariants,
	ActionColors,
	BaseActionVariants,
	IconVariants,
} from '@customTypes/ui/action.types';
import Icon from '@components/common/Icon';
import type { IconNames } from '@/core/types/ui/iconNames.type';
import type { SocialLinkVariants } from '@/core/types/ui/socialLinkVariants.type';

// Define the props interface for the ActionIcon component
type ActionIconProps<T extends 'a' | 'button'> = {
	[P in keyof React.ComponentPropsWithoutRef<T>]: React.ComponentPropsWithoutRef<T>[P];
} & {
	icon: IconNames;
	iconSize?: string;
	variant?: BaseActionVariants | SocialLinkVariants;
	iconVariant?: IconVariants;
	color?: ActionColors;
	as?: T;
	href?: string | undefined;
	title?: string;
	target?: string;
	className?: string;
	children?: React.ReactNode;
};

/**
 * ActionIcon component renders an icon within an action button or link.
 * It uses the ActionBase component for consistent styling and behavior.
 */
const ActionIcon: React.FC<ActionIconProps<'a' | 'button'>> = ({
	icon,
	iconSize = 'w-6 h-6',
	variant,
	iconVariant,
	color = 'primary',
	as = variant === 'scroll' ? 'a' : 'button',
	href,
	title = 'Icon Action',
	target = as === 'a' && href ? '_self' : undefined,
	className,
	children,
	...rest
}) => {
	// Compute the correct variant
	const computedVariant: ActionVariants = iconVariant ?? (`icon-${variant}` as ActionVariants);

	// Add noopener noreferrer for security when using target="_blank"
	const rel = target === '_blank' ? 'noopener noreferrer' : undefined;

	return (
		<ActionBase
			as={as}
			variant={computedVariant}
			href={as === 'a' && href ? href : undefined} // Apply href only if it's an <a>
			title={title}
			color={color}
			target={as === 'a' && target ? target : undefined} // Apply target only if it's an <a>
			rel={as === 'a' && target === '_blank' ? rel : undefined} // Apply rel for security if it's an external link
			className={className}
			{...rest}
		>
			<Icon icon={icon} size={iconSize} />
			{children}
		</ActionBase>
	);
};

export default ActionIcon;
