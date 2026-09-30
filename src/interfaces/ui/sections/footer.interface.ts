export interface FooterProps {
	siteInfo: {
		slogan?: string;
	};
	linkGroups: Array<{
		title: string;
		links: Array<{
			label: string;
			href: string;
			isExternal?: boolean;
		}>;
	}>;
	contact?: {
		title: string;
		whatsappLabel: string;
		email: string;
		city: string;
	};
	socialLinks?: {
		links: Array<{
			label: string;
			href: string;
			icon?: string;
		}>;
	};
}
