// ActionBase.tsx
import React from 'react';

// Define the base variants
export type BaseActionVariants = 'primary' | 'secondary' | 'text' | 'scroll' | 'large' | 'whatsapp';

// Define the external and icon variants
export type ExternalVariants = `external-${BaseActionVariants}`;
export type IconVariants = `icon-${BaseActionVariants}`;

// Define the possible variants for the Action component.
export type ActionVariants = BaseActionVariants | ExternalVariants | IconVariants;

// Define the possible colors for the Action component.
export type ActionColors = 'primary' | 'secondary' | 'accent' | 'neutral';

// Define the types of elements the component can render.
type ElementType = 'a' | 'button' | 'div';

// Define a type-safe prop extension based on the element type.
type ElementProps<T extends ElementType> = T extends 'a'
  ? React.AnchorHTMLAttributes<HTMLAnchorElement>
  : T extends 'button'
  ? React.ButtonHTMLAttributes<HTMLButtonElement>
  : React.HTMLAttributes<HTMLDivElement>;

// Define props for ActionBase, allowing customization and flexibility.
type ActionBasePropsType<T extends ElementType = 'button'> = ElementProps<T> & {
  variant?: ActionVariants;
  color?: ActionColors;
  as?: T;
  className?: string;
  onClick?: (event: React.MouseEvent<T extends 'a' ? HTMLAnchorElement : T extends 'button' ? HTMLButtonElement : HTMLDivElement>) => void;
};

// ActionBase component provides a flexible structure for different types of actions.
const ActionBase = <T extends ElementType = 'button'>({
  variant = 'primary',
  color = 'primary',
  as,		// Define the element type (a, button, div)
  className,
  onClick, 	// Allow custom onClick event handler
  children, // Slot equivalent for React components
  ...rest 	// Allow other props
}: ActionBasePropsType<T>) => {
  // Compute the correct variant, ensuring it matches the defined types in ActionVariants.
  const Element = as || ('button' as React.ElementType);
  // Generate the classes based on the variant and color
  const variantClass = `action-${variant}`;
  const colorClass = `color-${color}`;

  // Generate the combined classes
  const buttonClasses = `action-base ${variantClass} ${colorClass} ${className || ''}`.trim();

  return (
	// Render the element
		  <div className="action-base-wrapper">

			<Element className={buttonClasses} onClick={onClick} {...rest}>
				{children}
			</Element>
		  </div>
  );
};

export default ActionBase;
