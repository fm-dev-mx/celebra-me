import type { FooterProps } from '@/interfaces/ui/sections/footer.interface';

export const footerData: FooterProps = {
	siteInfo: {
		slogan: 'Celebre cada momento, diseñe cada recuerdo.',
	},
	// Navigation lives in the header and the legal links in the footer's bottom row.
	linkGroups: [],
	contact: {
		title: 'Contacto',
		whatsappLabel: 'WhatsApp',
		email: 'contacto@celebra-me.com',
		city: 'Los Mochis, Sinaloa',
	},
	socialLinks: {
		links: [
			{
				label: 'Instagram',
				href: 'https://www.instagram.com/celebra_me_com/',
				icon: 'InstagramIcon',
			},
			{
				label: 'Facebook',
				href: 'https://www.facebook.com/invitaciones.celebrame',
				icon: 'FacebookIcon',
			},
		],
	},
};
