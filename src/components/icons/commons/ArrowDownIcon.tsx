import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

const ArrowIcon: React.FC<IconProps> = ({
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
    strokeWidth={1.5}
    strokeLinecap="square"
    strokeLinejoin="bevel"
    width={size}
    height={size}
    {...rest}
  >
    <path d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
  </svg>
);

export default React.memo(ArrowIcon);
