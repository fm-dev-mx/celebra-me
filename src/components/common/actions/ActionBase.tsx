// ActionBase.tsx
import React from 'react';

// Define the possible variants for the Action component.
export type ActionVariants = 'primary' | 'secondary' | 'tertiary' | 'text' | 'icon' | 'scroll' | 'logo' | 'large';

// Define the possible colors for the Action component.
export type ActionColors = 'primary' | 'secondary' | 'accent' | 'neutral' | 'text';

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
  variant = 'primary', // Default to 'primary' variant if none is provided.
  color = 'primary', // Default to 'primary' color if none is provided.
  as, // Determines the type of element to render.
  className, // Allows passing additional class names.
  onClick, // Allows passing an onClick event.
  children, // Slot equivalent for React components.
  ...rest // Spread any other attributes to the rendered element.
}: ActionBasePropsType<T>) => {
  // Determine the correct element type to render, defaulting to button if not specified.
  const Element = as || ('button' as React.ElementType);

  // Generate class names based on variant and color.
  const variantClass = `action-${variant}`; // Example: action-primary, action-secondary, etc.
  const colorClass = `color-${color}`; // Example: color-primary, color-accent, etc.

  // Combine the base class with dynamic classes for styling.
  const buttonClasses = `action-base ${variantClass} ${colorClass} ${className || ''}`.trim();

  return (
    // Render the component with the specified element type (a, button, or div).
    <Element className={buttonClasses} onClick={onClick} {...rest}>
      {children} {/* Allows content to be passed into the component, keeping it flexible. */}
    </Element>
  );
};

export default ActionBase;
