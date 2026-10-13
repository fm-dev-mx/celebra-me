/**
 * Spanish copy and formatting for the administrator engagement ranking. UI strings are Spanish
 * ("usted" register); identifiers stay English. The panel only paints what is resolved here.
 */

import type {
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

export const GROUP_KEY_LABELS: Record<RankingGroupKey, string> = {
	themePreset: 'Preset de tema',
	templateId: 'Plantilla',
	fontFamily: 'Tipografía',
	visualProfileId: 'Perfil visual',
	personalizedAccessVariant: 'Acceso personalizado',
	rsvpConfirmationMode: 'Modo de confirmación',
	rsvpAccessMode: 'Modo de acceso al RSVP',
	musicEnabled: 'Música',
};

export const METRIC_LABELS: Record<RankingMetric, string> = {
	rsvpConversion: 'Conversión a respuesta',
	openRate: 'Tasa de apertura',
	completionRate: 'Lectura completa',
	medianSecondsToRespond: 'Tiempo hasta responder',
};

export const EVENT_TYPE_OPTIONS = EVENT_TYPES.map((value) => ({
	value,
	label: EVENT_TYPE_LABELS[value],
}));

export const rankingCopy = {
	title: 'Ranking de diseños',
	intro: 'Compara invitaciones y diseños con las métricas permanentes de engagement. Los datos existen desde {since}; las tasas son hipótesis, no veredictos.',
	filters: {
		eventType: 'Tipo de evento',
		groupBy: 'Agrupar por',
		metric: 'Ordenar por',
	},
	loading: 'Cargando ranking…',
	error: 'No fue posible cargar el ranking. Intente de nuevo más tarde.',
	unavailable: 'El ranking todavía no está disponible en este entorno.',
	empty: 'Aún no hay invitaciones de este tipo con datos de engagement.',
	designsTitle: 'Diseños',
	invitationsTitle: 'Invitaciones',
	insufficient: (thresholds: RankingThresholds) =>
		`Muestra insuficiente: menos de ${thresholds.sharedGuests} invitados con invitación enviada.`,
	groupTooSmall: (thresholds: RankingThresholds) =>
		`Grupo sin ranking: menos de ${thresholds.groupInvitations} invitaciones con muestra suficiente.`,
	noDesign: 'Sin datos de diseño',
	deletedEvent: 'Evento eliminado',
	rules: (thresholds: RankingThresholds) => [
		'Solo se comparan invitaciones del mismo tipo de evento.',
		`Una invitación entra en la comparación con al menos ${thresholds.sharedGuests} invitados con invitación enviada; un grupo de diseño se ordena con al menos ${thresholds.groupInvitations} invitaciones comparables.`,
		'Se ordena por tasas, nunca por totales, y la razón de reaperturas no ordena.',
		'La anticipación del envío y la cobertura de recordatorios se muestran junto a cada tasa porque influyen en el resultado.',
	],
	columns: {
		rank: '#',
		group: 'Grupo',
		invitations: 'Invitaciones',
		eligible: 'Comparables',
		invitation: 'Invitación',
		eventDate: 'Fecha',
		snapshot: 'Snapshot',
		shared: 'Enviadas',
		opened: 'Abiertas',
		responded: 'Respondieron',
		openRate: 'Apertura',
		completionRate: 'Lectura completa',
		rsvpConversion: 'Conversión',
		reopenRatio: 'Reaperturas',
		timeToRespond: 'Tiempo a responder',
		mobileShare: 'Móvil',
		shareLeadDays: 'Anticipación',
		reminderCoverage: 'Recordatorios',
	},
	snapshotKind: { rolling: 'En curso', final: 'Final' } as const,
} as const;

/** Rates arrive as fractions; null denominators render as a dash, never as 0 %. */
export function formatRate(value: number | null): string {
	if (value === null) return '—';
	return `${(value * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 })} %`;
}

export function formatRatio(value: number | null): string {
	if (value === null) return '—';
	return `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })}×`;
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
