/**
 * Servicios para Soft Delete
 * Permite "eliminar" registros sin borrarlos permanentemente
 */

import { supabaseRestRequest } from './supabase';
import type { EventRecord } from './types';

/**
 * Realiza soft delete de un evento usando la función RPC
 * Solo el owner o super_admin pueden hacer soft delete
 */
export async function softDeleteEventService(eventId: string, userId: string): Promise<boolean> {
	try {
		const result = await supabaseRestRequest<{ success: boolean }>({
			pathWithQuery: 'rpc/soft_delete_event',
			method: 'POST',
			useServiceRole: true,
			body: {
				p_event_id: eventId,
				p_user_id: userId,
			},
		});

		return result?.success || false;
	} catch (error) {
		throw new Error(
			`Error al eliminar evento: ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
}

/**
 * Restaura un evento eliminado
 * Solo super_admin puede restaurar
 */
export async function restoreEventService(eventId: string, userId: string): Promise<boolean> {
	try {
		const result = await supabaseRestRequest<{ success: boolean }>({
			pathWithQuery: 'rpc/restore_event',
			method: 'POST',
			useServiceRole: true,
			body: {
				p_event_id: eventId,
				p_user_id: userId,
			},
		});

		return result?.success || false;
	} catch (error) {
		throw new Error(
			`Error al restaurar evento: ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
}

/**
 * Lista eventos eliminados (papelera)
 * Solo super_admin tiene acceso a esta función
 */
export async function listDeletedEventsService(): Promise<EventRecord[]> {
	try {
		const result = await supabaseRestRequest<EventRecord[]>({
			pathWithQuery: 'deleted_events?select=*',
			useServiceRole: true,
		});

		return result || [];
	} catch (error) {
		throw new Error(
			`Error al listar eventos eliminados: ${error instanceof Error ? error.message : 'Unknown error'}`,
		);
	}
}
