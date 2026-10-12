import type { IconProps } from '@/components/common/icons/types/IconProps';

// Sixteen straight rays (long and short) around an open disc; the disc stays empty so a reveal
// can press a monogram into it.
const RAYS =
	'M12 1.6v3.1M12 19.3v3.1M1.6 12h3.1M19.3 12h3.1M4.6 4.6l2.2 2.2M17.2 17.2l2.2 2.2M19.4 4.6l-2.2 2.2M6.8 17.2l-2.2 2.2M8 2.4l.8 2M15.2 19.6l.8 2M2.4 16l2-.8M19.6 8.8l2-.8M16 2.4l-.8 2M8.8 19.6l-.8 2M21.6 16l-2-.8M4.4 8.8l-2-.8';

export const SunburstSealIcon = ({ className, size = 24 }: IconProps) => (
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		strokeWidth="1.05"
		strokeLinecap="round"
		className={className}
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d={RAYS} />
		<circle cx="12" cy="12" r="6" fill="currentColor" fillOpacity="0.14" />
		<circle cx="12" cy="12" r="4.7" strokeWidth="0.6" strokeOpacity="0.6" />
	</svg>
);
