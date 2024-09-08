import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  primaryColor?: string;
  secondaryColor?: string;
}
const MenuIcon: React.FC<IconProps> = ({
  primaryColor = 'currentColor',
  secondaryColor = 'currentColor',
  className,
  ...rest
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    fill="none"
    strokeWidth={2}
    {...rest}
  >
    <path
      stroke={primaryColor}
      d="M9 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
    />
    <path stroke={secondaryColor} d="M7 3.34A10 10 0 1 1 3.34 7" />
  </svg>
);

export default React.memo(MenuIcon);
