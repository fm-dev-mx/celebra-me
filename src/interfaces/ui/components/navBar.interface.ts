export interface NavBarProps {
	headerId: string;
	links: Array<{
		label: string;
		href: string;
	}>;
	logoSrc?: string | ImageMetadata;
}
import type { ImageMetadata } from 'astro';
