/**
 * Spanish copy and formatting for the administrator engagement ranking. UI strings are Spanish
 * ("usted" register); identifiers stay English. The panel only paints what is resolved here.
 */

import type {
	RankingActivityState,
	RankingEventStatus,
	RankingGroupKey,
	RankingMetric,
	RankingThresholds,
} from '@/interfaces/dashboard/engagement-ranking.interface';
import { EVENT_TYPES, type EventType } from '@/lib/theme/theme-contract';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
	xv: 'XV años',
	boda: 'Boda',
	bautizo: 'Bautizo',
	cumple: 'Cumpleaños',
	'baby-shower': 'Baby shower',
	'primera-comunion': 'Primera comunión',
};

const ALL_EVENT_TYPES_OPTION = { value: 'all', label: 'Todos' } as const;

export const EVENT_TYPE_OPTIONS = [
	ALL_EVENT_TYPES_OPTION,
	...EVENT_TYPES.map((value) => ({ value, label: EVENT_TYPE_LABELS[value] })),
];

export function eventTypeLabel(value: string): string {
	return (EVENT_TYPE_LABELS as Record<string, string>)[value] ?? value;
}

export const GROUP_KEY_LABELS: Record<RankingGroupKey, string> = {
	themePreset: 'Preset de tema',
	personalizedAccessVariant: 'Acceso personalizado',
	rsvpAccessMode: 'Modo de acceso al RSVP',
};

export const METRIC_LABELS: Record<RankingMetric, string> = {
	responseRate: 'Tasa de respuesta',
	openRate: 'Apertura',
	completionRate: 'Lectura completa',
	conversionUpper: 'Conversión (cota superior)',
	medianSecondsToRespond: 'Tiempo hasta responder',
};

export const EVENT_STATUS_LABELS: Record<RankingEventStatus, string> = {
	upcoming: 'Próximas',
	past: 'Pasadas',
	unknown: 'Sin fecha',
};

export const ACTIVITY_LABELS: Record<RankingActivityState, string> = {
	measured: 'Con datos medidos',
	none: 'Sin actividad',
};

const CONFIRMATION_LABELS: Record<string, string> = {
	api: 'Formulario',
	whatsapp: 'WhatsApp',
	both: 'Formulario y WhatsApp',
};

const RSVP_ACCESS_LABELS: Record<string, string> = {
	'personalized-only': 'Solo enlace personalizado',
	hybrid: 'Híbrido',
};

/** Human label for a facet or group value of the given key. */
export function valueLabel(key: string, value: string | null): string {
	if (value === null) return 'Sin dato';
	if (key === 'confirmationMode') return CONFIRMATION_LABELS[value] ?? value;
	if (key === 'rsvpAccessMode') return RSVP_ACCESS_LABELS[value] ?? value;
	return value;
}

/** Confidence level shown next to each column, so no figure mixes levels. */
export const LEVEL_LABELS = {
	exact: 'Exacto',
	measured: 'Medido',
	inferred: 'Inferido',
	bound: 'Cota',
} as const;
export type LevelKey = keyof typeof LEVEL_LABELS;

export const rankingCopy = {
	title: 'Ranking de diseños',
	intro: 'Las cifras exactas salen de las respuestas de los invitados; las medidas, del registro de aperturas que existe desde el {since}; las inferidas suponen que quien respondió abrió la invitación. Las tasas son hipótesis, no veredictos.',
	filters: {
		eventType: 'Tipo de evento',
		groupBy: 'Agrupar por',
		metric: 'Ordenar por',
		open: 'Filtros',
		eventStatus: 'Estado del evento',
		activity: 'Actividad',
		fontFamily: 'Tipografía',
		music: 'Música',
		musicWith: 'Con música',
		musicWithout: 'Sin música',
		confirmationMode: 'Modo de confirmación',
		includeDisabled: 'Incluir invitaciones deshabilitadas',
		any: 'Todas',
		clear: 'Limpiar filtros',
		remove: 'Quitar filtro',
		showing: (listed: number, total: number) => `Mostrando ${listed} de ${total}`,
	},
	loading: 'Cargando ranking…',
	error: 'No fue posible cargar el ranking. Intente de nuevo más tarde.',
	unavailable: 'El ranking todavía no está disponible en este entorno.',
	empty: 'Ninguna invitación coincide con los filtros.',
	designsTitle: 'Diseños',
	invitationsTitle: 'Invitaciones',
	insufficient: (thresholds: RankingThresholds) =>
		`Muestra insuficiente: menos de ${thresholds.sharedGuests} invitados con invitación enviada.`,
	groupTooSmall: (thresholds: RankingThresholds) =>
		`Grupo sin ranking: menos de ${thresholds.groupInvitations} invitaciones comparables.`,
	noActivity: (since: string) => `Sin actividad desde el ${since}`,
	disabled: 'Deshabilitada',
	conversionNone: 'No medible (WhatsApp)',
	conversionPartial: 'Parcial',
	rules: (thresholds: RankingThresholds) => [
		'Solo se comparan invitaciones del mismo tipo de evento; con «Todos» el ranking se calcula dentro de cada tipo.',
		`Una invitación entra en la comparación con al menos ${thresholds.sharedGuests} invitados con invitación enviada; un grupo de diseño se ordena con al menos ${thresholds.groupInvitations} invitaciones comparables.`,
		'La conversión es una cota superior: las aperturas anteriores al registro se infieren de las respuestas. Las invitaciones que confirman total o parcialmente por WhatsApp no entran en los órdenes por respuesta, porque esas respuestas no llegan a la base de datos.',
		'Las invitaciones deshabilitadas nunca se ordenan. La anticipación del envío y la cobertura de recordatorios influyen en el resultado.',
	],
	columns: {
		rank: '#',
		type: 'Tipo',
		group: 'Grupo',
		invitations: 'Invitaciones',
		comparable: 'Comparables',
		invitation: 'Invitación',
		eventDate: 'Fecha',
		shared: 'Enviadas',
		responded: 'Respondieron',
		respondedSelf: 'Por el invitado',
		responseRate: 'Tasa de respuesta',
		opened: 'Abiertas',
		openedInferred: 'Abiertas (incl. inferidas)',
		conversion: 'Conversión',
		openRate: 'Apertura',
		completionRate: 'Lectura completa',
		timeToRespond: 'Tiempo a responder',
		shareLeadDays: 'Anticipación',
		reminderCoverage: 'Recordatorios',
	},
} as const;

/** Rates arrive as fractions; null denominators render as a dash, never as 0 %. */
export function formatRate(value: number | null): string {
	if (value === null) return '—';
	return `${(value * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`;
}

/** Upper bounds read as «≤ 98 %» so they are never taken for a point value. */
export function formatUpperBound(value: number | null): string {
	return value === null ? '—' : `≤ ${formatRate(value)}`;
}

/** Durations in the units a person reads: minutes under an hour, hours under two days, else days. */
export function formatDurationSeconds(seconds: number | null): string {
	if (seconds === null) return '—';
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min`;
	const hours = seconds / 3600;
	if (hours < 48) return `${hours.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`;
	return `${(hours / 24).toLocaleString('es-MX', { maximumFractionDigits: 1 })} d`;
}

export function formatDays(days: number | null): string {
	if (days === null) return '—';
	return `${days.toLocaleString('es-MX', { maximumFractionDigits: 1 })} d`;
}

export function formatDate(value: string | null): string {
	if (!value) return '—';
	const date = new Date(`${value}T00:00:00`);
	return Number.isNaN(date.getTime())
		? value
		: date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
