import type { IconProps } from '@/components/common/icons/types/IconProps';

export const PhotoIcon = ({ className, size = 24 }: IconProps) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect x="3" y="4" width="18" height="15" rx="2" />
		<circle cx="12" cy="11.5" r="2.5" />
		<path d="m3 19 4.5-5 4 4 4.5-6.5 5 7.5" />
	</svg>
);
