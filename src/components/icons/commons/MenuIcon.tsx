import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  primaryColor?: string;
  secondaryColor?: string;
}
const MenuIcon: React.FC<IconProps> = ({
  primaryColor = 'var(--primary-dark)',
  secondaryColor = 'var(--primary-default)',
  className,
  ...rest
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    strokeWidth={2}
    {...rest}
  >
   <path
  stroke={primaryColor} // Aplica el color del contorno
  fill="none" // Asegúrate de que no haya relleno no deseado
  d="M9 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
/>
<path
  stroke={secondaryColor}
  fill="none" // Asegura que el relleno no se vea negro
  d="M7 3.34A10 10 0 1 1 3.34 7"
/>

  </svg>
);

export default React.memo(MenuIcon);
