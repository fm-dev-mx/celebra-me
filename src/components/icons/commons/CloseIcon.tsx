import React from 'react';

interface IconProps {
  color?: string;
  size?: number | string; // Para ajustar el tamaño
  className?: string; // Para añadir clases CSS adicionales
}

const CloseIcon: React.FC<IconProps> = ({
  size = 32,
  className = '',
}) => {

	const circleColor = 'var(--primary-default)';
	const crossColor = 'var(--primary-dark)';
	const bgColor = 'var(--primary-light)';

  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 32 32"
      xmlSpace="preserve"
      width={size}
      height={size}
      className={className}
    >
      <g>
        <circle className="pictogram_vier" cx="16" cy="16" r="13" fill={bgColor} />
        <path
          className="pictogram_drie"
          d="M16,3v26c7.18,0,13-5.82,13-13C29,8.82,23.18,3,16,3z"
          fill={circleColor} // Aplica el segundo color
        />
        <path
          className="pictogram_een"
          d="M16,3c7.168,0,13,5.832,13,13s-5.832,13-13,13S3,23.168,3,16S8.832,3,16,3 M16,0 C7.163,0,0,7.163,0,16s7.163,16,16,16s16-7.163,16-16S24.837,0,16,0L16,0z M18.121,16l2.475-2.475c0.586-0.585,0.586-1.536,0-2.121 c-0.586-0.586-1.535-0.586-2.121,0L16,13.879l-2.475-2.475c-0.586-0.586-1.535-0.586-2.121,0c-0.586,0.585-0.586,1.536,0,2.121 L13.879,16l-2.475,2.475c-0.586,0.585-0.586,1.536,0,2.121c0.293,0.293,0.677,0.439,1.061,0.439s0.768-0.146,1.061-0.439L16,18.121 l2.475,2.475c0.293,0.293,0.677,0.439,1.061,0.439s0.768-0.146,1.061-0.439c0.586-0.585,0.586-1.536,0-2.121L18.121,16z"
          fill={crossColor} // Aplica el primer color
        />
      </g>
    </svg>
  );
};

export default CloseIcon;
