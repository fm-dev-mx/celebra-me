// ActionIcon.tsx
import React from 'react';
import ActionBase, { type ActionVariants, type ActionColors } from './ActionBase';
import Icon from '@/components/common/Icon';
import type { IconNames } from '@/config/landing.interface';

// Define props for ActionIcon, extending the base functionality to include icons and supporting different elements.
interface ActionIconProps extends React.HTMLAttributes<HTMLButtonElement | HTMLAnchorElement> {
  icon: IconNames; // Defines the icon to be displayed in the action.
  iconSize?: string; // Optional size control for the icon, e.g., "w-6 h-6".
  variant?: ActionVariants; // Inherited from ActionBase for variant styling.
  color?: ActionColors; // Inherited from ActionBase for color styling.
  as?: 'button' | 'a'; // Specifies the element type, defaulting to 'button' but can be 'a' for links.
  href?: string; // Optional href for link elements when `as` is 'a'.
  target?: '_self' | '_blank'; // Optional target attribute for links.
  className?: string; // Allows adding extra classes if needed.
}

// Functional component for ActionIcon
const ActionIcon: React.FC<ActionIconProps> = ({
  icon,
  iconSize = 'w-6 h-6', // Default size if not specified.
  variant = 'primary', // Default to 'primary' variant if none is provided.
  color = 'primary', // Default to 'primary' color if none is provided.
  as = 'button', // Default to 'button' but can be 'a'.
  href, // Used if `as` is 'a'.
  target = '_self', // Target attribute for links.
  className, // Additional classes for the component.
  children, // Allows additional content next to the icon, maintaining flexibility.
  ...rest // Pass remaining props to ActionBase.
}) => {

		// Generate class names based on variant and color.
	const variantClass = `action-icon-${variant}`; // Example: action-primary, action-secondary, etc.
	const colorClass = `color-${color}`; // Example: color-primary, color-accent, etc.

	// Combine the variant and color classes
	const combinedClasses = `action-icon ${variantClass} ${colorClass} ${className || ''}`;



  return (
    <ActionBase
      as={as} // Pass the specified element type.
      href={href} // Pass href when the element is an anchor.
      target={target} // Pass target attribute for anchor links.
      className={combinedClasses} // Apply combined classes for variant and color.
      {...rest} // Spread remaining props.
    >
      <Icon icon={icon} size={iconSize} /> {/* Render the icon with the specified size */}
      {children} {/* Allows additional content next to the icon */}
    </ActionBase>
  );
};

export default ActionIcon;
