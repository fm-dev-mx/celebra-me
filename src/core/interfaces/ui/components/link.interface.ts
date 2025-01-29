// src/core/interfaces/ui/sections/footer.interface.ts

export interface LinkProps {
	label?: string;
	href: string;
	isExternal?: boolean;
	target?: '_blank' | '_self';
}

export interface LinkGroup {
	title: string;
	links: LinkProps[];
}
