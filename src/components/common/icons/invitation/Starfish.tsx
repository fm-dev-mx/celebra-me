import type { IconProps } from '@/components/common/icons/types/IconProps';

export const StarfishIcon = ({ className, size = 24 }: IconProps) => (
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
		<path d="M12 3l2.2 6.4 6.8.2-5.4 4.1 2 6.5-5.6-3.9-5.6 3.9 2-6.5L3 9.6l6.8-.2L12 3Z" />
		<path d="M12 7.2v1.1M17.4 10.4l-1 .4M15.3 17l-.6-.9M8.7 17l.6-.9M6.6 10.4l1 .4" />
		<circle cx="12" cy="12.6" r="0.9" />
	</svg>
);
