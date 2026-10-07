import type { IconProps } from '@/components/common/icons/types/IconProps';

export const WaveIcon = ({ className, size = 24 }: IconProps) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M2 8.5c1.7 0 1.7-1.6 3.3-1.6S7 8.5 8.7 8.5s1.6-1.6 3.3-1.6 1.6 1.6 3.3 1.6 1.7-1.6 3.4-1.6S20.3 8.5 22 8.5" />
		<path d="M2 13c1.7 0 1.7-1.6 3.3-1.6S7 13 8.7 13s1.6-1.6 3.3-1.6 1.6 1.6 3.3 1.6 1.7-1.6 3.4-1.6S20.3 13 22 13" />
		<path d="M5.3 17.5c1.7 0 1.7-1.6 3.4-1.6s1.6 1.6 3.3 1.6 1.6-1.6 3.3-1.6 1.7 1.6 3.4 1.6" />
	</svg>
);
