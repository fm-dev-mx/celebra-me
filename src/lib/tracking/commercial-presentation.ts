import type { CountItem } from '@/lib/tracking/commercial-dashboard';

export const EVENT_TYPE_LABELS: Record<string, string> = {
	xv: 'XV años',
	boda: 'Boda',
	bautizo: 'Bautizo',
	cumple: 'Cumpleaños',
	'baby-shower': 'Baby shower',
	'primera-comunion': 'Primera comunión',
};

export function labelCommercialEventType(eventType?: string | null): string {
	return eventType ? (EVENT_TYPE_LABELS[eventType] ?? eventType) : 'Por definir';
}

const TECHNICAL_ATTRIBUTION_PATTERN =
	/(debug_|commercial_dashboard_health|localhost|127[.]0[.]0[.]1|\/api\/|\/dashboard\/|qa(?:_|\b)|test\d*|health)/i;

const ATTRIBUTION_LABELS: Record<string, string> = {
	'hero-secondary': 'Portada · Acción secundaria',
	hero_secondary: 'Portada · Acción secundaria',
	'event-types': 'Tipos de evento',
	event_types: 'Tipos de evento',
	'demo-xv-editorial': 'Demo XV editorial',
	'demo-xv-jewelry-box': 'Demo XV · Jewelry Box',
};

const ATTRIBUTION_TERMS: Record<string, string> = {
	hero: 'Portada',
	secondary: 'Acción secundaria',
	pricing: 'Precios',
	whatsapp: 'WhatsApp',
	contact: 'Contacto',
	demo: 'Demo',
	xv: 'XV años',
	paid: 'Publicidad pagada',
	social: 'Redes sociales',
	organic: 'Orgánico',
	event: 'Evento',
	types: 'Tipos',
};

export interface CommercialAttributionPresentation {
	commercial: CountItem[];
	technical: CountItem[];
}

function humanizeCommercialAttributionLabel(label: string): string {
	const normalized = label.trim().toLowerCase();
	const exactLabel = ATTRIBUTION_LABELS[normalized];
	if (exactLabel) return exactLabel;

	return label
		.split(/[/_-]+/)
		.map((part) => part.trim())
		.filter(Boolean)
		.map(
			(part) =>
				ATTRIBUTION_TERMS[part.toLowerCase()] ||
				`${part.charAt(0).toUpperCase()}${part.slice(1)}`,
		)
		.join(' · ');
}

export function presentCommercialAttribution(
	items: CountItem[],
	technicalLabel = 'Datos internos / QA (no comerciales)',
): CommercialAttributionPresentation {
	const commercial = new Map<string, number>();
	let technicalCount = 0;

	for (const item of items) {
		if (TECHNICAL_ATTRIBUTION_PATTERN.test(item.label)) {
			technicalCount += item.count;
			continue;
		}

		const label = humanizeCommercialAttributionLabel(item.label);
		commercial.set(label, (commercial.get(label) || 0) + item.count);
	}

	const commercialItems = [...commercial]
		.map(([label, count]) => ({ label, count }))
		.sort((a, b) => b.count - a.count);
	const technicalItems =
		technicalCount > 0 ? [{ label: technicalLabel, count: technicalCount }] : [];

	return {
		commercial: commercialItems,
		technical: technicalItems,
	};
}
