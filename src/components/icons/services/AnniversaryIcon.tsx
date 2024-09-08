import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}
const AnniversaryIcon: React.FC<IconProps> = ({
  className,
  size = 24,
  color = 'currentColor',
  ...rest
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    fill="none"
    stroke={color}
    strokeWidth={1.91}
    strokeMiterlimit={10}
    width={size}
    height={size}
    {...rest}
  >
    {/* Two overlapping circles, possibly representing unity or connection */}
    <circle cx="8.66" cy="15.34" r="7.16" />
    <circle cx="16.3" cy="12.48" r="6.2" />

    {/* Triangular shape at the top, could represent a crown or celebratory symbol */}
    <polygon points="16.77 6.27 15.82 6.27 12.96 3.41 13.91 1.5 18.68 1.5 19.64 3.41 16.77 6.27" />
  </svg>
);

export default React.memo(AnniversaryIcon);
