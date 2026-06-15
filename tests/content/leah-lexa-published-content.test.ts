import { eventContentSchema } from '@/lib/schemas/content/base-event.schema';

describe('Leah Lexa SQL patch published content', () => {
	it('validates the full v_content JSON against eventContentSchema', () => {
		const content = {
			eventType: 'baby-shower',
			isDemo: false,
			title: 'Baby Shower de Leah Lexa',
			description:
				'Invitacion real para celebrar el Baby Shower de Leah Lexa. Los recursos visuales incluyen imagenes oficiales del cliente.',
			_assetSlug: 'leah-lexa-baby-shower',
			theme: {
				fontFamily: 'serif',
				preset: 'celestial-blue',
			},
			eventTiming: {
				localDateTime: '2026-06-21T14:00',
				timeZone: 'America/Mexico_City',
				startsAtUtc: '2026-06-21T20:00:00.000Z',
			},
			sectionOrder: [
				'quote',
				'family',
				'location',
				'gifts',
				'personalizedAccess',
				'rsvp',
				'gallery',
				'thankYou',
			],
			sectionStyles: {
				location: { showFlourishes: true },
				rsvp: {
					labels: {
						name: 'Tu nombre',
						guestCount: 'Personas que asistirán',
						attendance: '¿Me acompañas?',
						confirmButton: 'Confirmar asistencia',
					},
				},
			},
			hero: {
				name: 'Leah Lexa',
				label: 'Mi Baby Shower',
				date: '2026-06-21T20:00:00.000Z',
				backgroundImage: 'hero',
			},
			quote: {
				text: 'Los tiempos de Dios son perfectos, y les ha dado la dicha a mis papis de hacer crecer nuestra familia.',
				author: 'Leah Lexa',
			},
			family: {
				featuredImage: 'family',
				parents: { father: 'Hugo', mother: 'Fernanda' },
				parentsOrder: 'father-first',
				focalPoint: '50% 50%',
				labels: {
					sectionTitle: 'Mis papis',
					sectionSubtitle: 'Hugo y Fernanda',
					parentsTitle: 'Con mucho amor',
					sectionMessage:
						'Quieren compartir con ustedes mi Baby Shower. Desde la pancita de mamá, ya siento el cariño con el que me esperan.',
				},
			},
			gallery: {
				variant: 'single',
				presentation: 'pet-keepsake',
				title: 'La manada también te espera',
				subtitle: 'En casa ya hay patitas listas para recibirte con amor.',
				items: [{ image: 'gallery03' }],
			},
			interludes: [
				{
					image: 'gallery01',
					afterSection: 'quote',
					height: 'medium',
					alt: 'Antes de conocerte, ya eras nuestro sueño más bonito.',
				},
			],
			location: {
				introEyebrow: 'Nos vemos para celebrar',
				introHeading: 'Domingo, 21 de junio de 2026',
				introLede: 'Quiero compartir este día tan especial con ustedes.',
				indicationsHeading: 'Detalles para mis invitados',
				venues: [
					{
						type: 'custom',
						id: 'baby-shower',
						venueEvent: 'Baby Shower',
						venueName: 'Casa de mi familia',
						address:
							'Calle 22, Manzana 1, Lote 20, Col. Guadalupe Proletaria, C.P. 07670',
						city: 'Ciudad de México',
						date: 'domingo, 21 de junio de 2026',
						time: '2:00 PM',
						mapUrl: 'https://www.google.com/maps/search/?api=1&query=Calle%2022%2C%20Manzana%201%2C%20Lote%2020%2C%20Col.%20Guadalupe%20Proletaria%2C%20C.P.%2007670',
						coordinates: { lat: 19.4853, lng: -99.143 },
					},
				],
				indications: [
					{
						iconName: 'MapLocation',
						styleVariant: 'default',
						text: 'Referencia: <strong>Casa color naranja al final de la calle, cerca de una capilla.</strong>',
					},
					{
						iconName: 'DressCode',
						styleVariant: 'reserved',
						text: 'Código de vestimenta: <strong>Ropa casual en colores pastel.</strong>',
					},
				],
			},
			gifts: {
				title: 'Mesa de regalos',
				subtitle:
					'Si desean tener un detalle para mí, mis papis prepararon una opción especial con mucho cariño.',
				items: [
					{
						type: 'store',
						title: 'Un detalle con cariño',
						description: 'Mesa disponible en Liverpool',
						url: 'https://mesaderegalos.liverpool.com.mx/milistaderegalos/51975133',
					},
				],
			},
			rsvp: {
				title: 'Confirma tu asistencia',
				subcopy:
					'Tu respuesta ayuda a mis papis a preparar cada detalle para recibirme con mucho cariño.',
				guestCap: 100,
				accessMode: 'personalized-only',
				confirmationMessage:
					'Gracias por confirmar. Mis papis y yo estamos muy felices de saber que nos acompañarán.',
				confirmationMode: 'api',
			},
			thankYou: {
				image: 'gallery02',
				message:
					'Este primer recuerdo y cada muestra de cariño serán parte de mi historia.',
				closingName: 'Leah Lexa',
			},
			envelope: {
				disabled: false,
				sealStyle: 'wax',
				sealIcon: 'monogram',
				sealInitials: 'LL',
				sealVariant: 'premium-rose',
				microcopy: 'Toca para abrir mi invitación',
				documentLabel: 'Baby Shower',
				cardLabel: 'Baby Shower',
				cardTagline: 'Una celebración celestial',
				stampText: 'Leah Lexa',
				stampYear: '2026',
				closedPalette: {
					primary: 'surfacePrimary',
					accent: 'actionAccent',
					background: 'surfacePrimary',
				},
			},
			sharing: {
				whatsappTemplate:
					'Hola {name}, soy Leah Lexa. Te comparto la invitación a mi Baby Shower: {inviteUrl}',
				ogImage: 'hero',
				ogDescription:
					'Acompáñame en mi Baby Shower el domingo, 21 de junio de 2026, a las 2:00 PM.',
			},
		};

		const result = eventContentSchema.safeParse(content);

		if (!result.success) {
			throw new Error(
				`Leah Lexa SQL patch content failed schema validation:\n${JSON.stringify(result.error.issues, null, 2)}`,
			);
		}

		expect(result.success).toBe(true);
		expect(result.data._assetSlug).toBe('leah-lexa-baby-shower');
		expect(result.data.envelope?.sealVariant).toBe('premium-rose');
		expect(result.data.hero.name).toBe('Leah Lexa');
	});
});
