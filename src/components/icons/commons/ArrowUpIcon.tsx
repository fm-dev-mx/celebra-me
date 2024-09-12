import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}
const ArrowUpIcon: React.FC<IconProps> = ({
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
    strokeWidth={2}
    strokeLinecap="square"
    strokeLinejoin="bevel"
    width={size}
    height={size}
    {...rest}
  >
    <path d="M12 21V3m0 0-7.5 7.5M12 3l7.5 7.5" />
  </svg>
);

export default React.memo(ArrowUpIcon);
