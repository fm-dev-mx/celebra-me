import type { IconProps } from '@/components/common/icons/types/IconProps';

/**
 * Calendar icon.
 */
export const CalendarIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect x="3" y="4" width="18" height="17" rx="2" ry="2" />
		<path d="M16 2v4" />
		<path d="M8 2v4" />
		<path d="M3 10h18" />
		<path d="M8 14h.01" />
		<path d="M12 14h.01" />
		<path d="M16 14h.01" />
		<path d="M8 18h.01" />
		<path d="M12 18h.01" />
	</svg>
);

export default CalendarIcon;
