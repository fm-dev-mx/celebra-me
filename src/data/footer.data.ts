import type { FooterProps } from '@/interfaces/ui/sections/footer.interface';

export const footerData: FooterProps = {
	siteInfo: {
		slogan: 'Celebre cada momento, diseñe cada recuerdo.',
	},
	linkGroups: [
		{
			title: 'Compañía',
			links: [
				{ label: 'Sobre Nosotros', href: '/#experiencia-invitados' },
				{ label: 'Demos', href: '/#tipo-evento' },
				{ label: 'Planes', href: '/#pricing' },
			],
		},
		{
			title: 'Legal',
			links: [
				{ label: 'Términos', href: '/terminos' },
				{ label: 'Privacidad', href: '/privacidad' },
			],
		},
	],
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
