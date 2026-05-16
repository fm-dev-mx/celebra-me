import type { LandingPageData } from '@/interfaces/ui/sections/landing-page.interface';

export const landingData: LandingPageData = {
	hero: {
		title: 'Momentos que se quedan en el corazón',
		subtitle:
			'Crea invitaciones digitales elegantes y personalizadas para tus eventos más especiales.',
		backgroundImage: {
			desktopUrl:
				'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=2069',
			mobileUrl:
				'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800&h=1200',
		},
		primaryCtaLabel: 'Crea tu Invitación',
		primaryCtaUrl: '#contacto',
		secondaryCtaLabel: 'Ver Catálogo',
		secondaryCtaUrl: '#servicios',
		whatsappPhone: '5216681167477',
		whatsappMessage:
			'¡Hola! Me gustaría crear una invitación digital premium para mi próximo evento. ¿Podrían asesorarme?',
		socialProofText: 'Más de 500 eventos inolvidables',
	},
	services: {
		title: 'Nuestros Servicios',
		services: [
			{
				href: '/xv/demo-xv-editorial',
				title: 'XV Años',
				description: 'Invitaciones mágicas para una noche inolvidable.',
				icon: 'CrownIcon',
			},
			{
				href: '/boda/demo-boda-jewelry-box-wedding',
				title: 'Bodas',
				description: 'Elegancia y distinción para el día más importante.',
				icon: 'RingsIcon',
			},
			{
				href: '/bautizo/demo-bautismo-angelic-presence',
				title: 'Bautizos',
				description: 'Detalles tiernos para celebrar la vida.',
				icon: 'DoveIcon',
			},
			{
				href: '/cumple/demo-cumple-luxury-hacienda',
				title: 'Cumpleaños',
				description: 'Demo premium para celebraciones con estilo.',
				icon: 'StarIcon',
			},
		],
	},
	about: {
		title: 'Nuestra Esencia',
		description:
			'En Celebra-me, nos apasiona diseñar los momentos más significativos de tu vida, fusionando arte digital con calidez humana para crear invitaciones que trascienden el tiempo.',
		values: [
			{
				name: 'Vanguardia Digital',
				description: 'Experiencias interactivas que sorprenden y deleitan.',
				icon: 'DiamondIcon',
			},
			{
				name: 'Detalle Impecable',
				description: 'Atención absoluta en cada trazo, color y tipografía.',
				icon: 'SparklesIcon',
			},
			{
				name: 'Cercanía y Calidez',
				description: 'Acompañamiento personal para que todo sea perfecto.',
				icon: 'UserGroupIcon',
			},
		],
		cta: {
			label: 'Agenda una consulta',
			href: '#contacto',
		},
	},
	testimonials: {
		title: 'Experiencias que trascienden',
		testimonials: [
			{
				name: 'Sofía & Alejandro',
				text: 'Nuestra boda fue un sueño hecho realidad. La invitación digital fue el primer detalle que dejó a todos sin palabras, capturando perfectamente la elegancia de nuestro gran día.',
				role: 'Boda en Hacienda del Mar',
			},
			{
				name: 'Isabella Martínez',
				text: 'Mis XV años fueron mágicos. Quería algo diferente y sofisticado; Celebra-me logró que mi invitación fuera tan especial como mi fiesta.',
				role: 'XV Años - Gala de Invierno',
			},
			{
				name: 'Familia Villarreal',
				text: 'Buscábamos excelencia y atención personalizada para el bautizo de nuestro hijo. Superaron nuestras expectativas con un diseño impecable y un servicio de acompañamiento único.',
				role: 'Bautizo',
			},
		],
	},
	pricing: {
		eyebrow: 'Inversión para tu celebración',
		title: 'Tres formas de crear tu invitación digital',
		intro: 'Todas las opciones incluyen invitación digital completa, confirmación de asistencia, panel de invitados y enlace personalizado. Elige el nivel de diseño y personalización que mejor se ajuste a tu celebración.',
		note: 'Promoción de lanzamiento en diseños seleccionados de colección: desde $499 MXN. Precio regular desde $899 MXN.',
		tiers: [
			{
				title: 'Colección',
				description: 'Diseños seleccionados, elegantes y listos para personalizar.',
				badge: 'Promoción de lanzamiento',
				price: { amount: '499', currency: 'MXN', period: 'pago único' },
				regularPrice: 'Precio regular desde $899 MXN',
				sections: [
					{
						title: 'Ideal para',
						items: [
							'Entregas ágiles en 24 horas hábiles*',
							'Eventos que necesitan un resultado elegante',
							'Quienes desean organizar y dar seguimiento a sus invitados',
						],
					},
					{
						title: 'Incluye',
						items: [
							'Diseño listo para adaptar a tu evento',
							'Personalización de fotos, textos y fechas',
							'Ajuste de colores y música',
							'Galería, ubicación y confirmación de asistencia',
							'Panel para gestionar invitados',
							'Enlace personalizado para compartir',
						],
					},
				],
				footnote: '*Tiempo estimado una vez recibido el contenido completo del evento.',
				cta: 'Elegir diseño de colección',
				href: '#contacto',
			},
			{
				title: 'Adaptación Editorial',
				description: 'Diseño ajustado con mayor intención visual para tu evento.',
				badge: 'Más recomendado',
				isPrimary: true,
				price: { amount: '1,499', currency: 'MXN', period: 'pago único' },
				sections: [
					{
						title: 'Ideal para',
						items: [
							'Celebraciones con una estética más definida',
							'Quienes buscan una invitación más exclusiva',
						],
					},
					{
						title: 'Diferencial',
						items: [
							'Propuesta visual única para tu evento',
							'Diseño adaptado a la identidad visual de tu evento',
							'Composición más cuidada de fotografías, color y tipografía',
							'Resultado más exclusivo y personalizado',
						],
					},
				],
				cta: 'Solicitar adaptación editorial',
				href: '#contacto',
			},
			{
				title: 'Diseño a la Medida',
				description: 'Experiencia visual única creada desde cero.',
				isExclusive: true,
				price: { amount: 'Cotización personalizada', currency: '', period: '' },
				regularPrice: 'Proyectos desde $2,500 MXN',
				sections: [
					{
						title: 'Ideal para',
						items: [
							'Eventos exclusivos o de autor',
							'Conceptos visuales muy específicos',
							'Celebraciones que requieren una experiencia única',
						],
					},
					{
						title: 'Diferencial',
						items: [
							'Concepto creativo desde cero',
							'Ilustración, composición o animación personalizada',
							'Secciones especiales según el evento',
							'Experiencia visual e interactiva personalizada',
							'Acompañamiento prioritario',
						],
					},
				],
				cta: 'Solicitar propuesta personalizada',
				href: '#contacto',
			},
		],
	},
	faq: {
		title: 'Preguntas Frecuentes',
		faqs: [
			{
				question: '¿Qué opción me conviene?',
				answer: 'Elige Colección si buscas una invitación rápida, elegante y lista para personalizar. Elige Adaptación Editorial si quieres una propuesta visual más cuidada y alineada al estilo de tu evento. Elige Diseño a la Medida si necesitas una experiencia completamente personalizada desde cero.',
			},
			{
				question: '¿Todas las invitaciones incluyen las mismas secciones?',
				answer: 'Sí. Todas las invitaciones pueden incluir portada, cuenta regresiva, itinerario, galería, ubicación, confirmación de asistencia, mesa de regalos, música, pase de acceso y otras secciones esenciales.',
			},
			{
				question: 'Entonces, ¿qué cambia entre cada opción?',
				answer: 'Lo que cambia es el nivel de diseño, dirección visual y personalización. No pagas por desbloquear secciones, sino por el grado de adaptación estética, composición y detalle de tu invitación.',
			},
			{
				question: '¿Incluye sistema para registrar y enviar invitaciones?',
				answer: 'Sí. Incluye un panel para registrar invitados, organizarlos por grupos, definir acompañantes, enviar enlaces personalizados por WhatsApp y consultar si cada invitación ya fue vista, incluyendo un avance aproximado de visualización.',
			},
			{
				question: '¿Cómo reciben la invitación mis invitados?',
				answer: 'Cada invitado puede recibir un enlace personalizado por WhatsApp, redes sociales o correo. Si actualizas información después, los cambios se reflejan en el mismo enlace.',
			},
			{
				question: '¿Puedo realizar cambios después de publicar?',
				answer: 'Sí. Puedes solicitar ajustes en datos, imágenes o secciones. El alcance de los cambios depende del nivel contratado y del momento en que se soliciten.',
			},
			{
				question: '¿La promoción de $499 aplica para cualquier diseño?',
				answer: 'No. La promoción de $499 MXN aplica solo para diseños seleccionados de colección. Adaptaciones editoriales y diseños a la medida se cotizan por separado.',
			},
		],
	},
	contact: {
		title: 'Su Asesor Personal',
		subtitle:
			'Comience su viaje hacia una celebración inolvidable. Permita que nuestro equipo de expertos le asista en cada detalle de su invitación digital.',
	},
};

export const footerData = {
	siteInfo: {
		slogan: 'Celebra cada momento, diseña cada recuerdo.',
	},
	linkGroups: [
		{
			title: 'Compañía',
			links: [
				{ label: 'Sobre Nosotros', href: '#nosotros' },
				{ label: 'Servicios', href: '#servicios' },
				{ label: 'Planes', href: '#pricing' },
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
	socialLinks: {
		links: [
			{ label: 'Instagram', href: 'https://instagram.com/celebrame', icon: 'InstagramIcon' },
			{ label: 'Facebook', href: 'https://facebook.com/celebrame', icon: 'FacebookIcon' },
		],
	},
};
