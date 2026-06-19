import type { IntakeBlockDefinition } from '@/lib/intake/types';

export const giftsBlock: IntakeBlockDefinition = {
	type: 'gifts',
	displayName: 'Mesa de regalos',
	description: 'Opciones de regalo: tiendas, transferencia bancaria, PayPal o lluvia de sobres.',
	fields: [
		{
			name: 'title',
			label: 'Título de la sección de regalos',
			type: 'text',
			required: false,
			placeholder: 'Ej: Mesa de Regalos, Lluvia de Sobres',
		},
		{
			name: 'subtitle',
			label: 'Subtítulo o mensaje (opcional)',
			type: 'textarea',
			required: false,
			placeholder: 'Ej: Tu presencia es el mejor regalo. Si deseas un detalle adicional:',
		},
		{
			name: 'bankName',
			label: 'Banco para transferencia (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: BBVA México',
		},
		{
			name: 'bankAccountHolder',
			label: 'Titular de la cuenta',
			type: 'text',
			required: false,
			placeholder: 'Ej: Fernando Valenzuela Robles',
		},
		{
			name: 'bankClabe',
			label: 'CLABE interbancaria',
			type: 'text',
			required: false,
			placeholder: 'Ej: 0121 8001 2345 6789 01',
		},
		{
			name: 'bankAccountNumber',
			label: 'Número de cuenta (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: 1234567890',
		},
		{
			name: 'cashEnabled',
			label: 'Incluir opción de lluvia de sobres',
			type: 'checkbox',
			required: false,
		},
		{
			name: 'cashText',
			label: 'Texto para lluvia de sobres (opcional)',
			type: 'text',
			required: false,
			placeholder: 'Ej: Contaremos con un buzón durante la recepción.',
		},
		{
			name: 'storeUrl',
			label: 'Enlace de tienda en línea (opcional)',
			type: 'url',
			required: false,
			placeholder: 'Ej: https://www.amazon.com.mx/wedding/registry/...',
		},
		{
			name: 'paypalUrl',
			label: 'Enlace de PayPal (opcional)',
			type: 'url',
			required: false,
			placeholder: 'Ej: https://paypal.me/usuario',
		},
	],
};
