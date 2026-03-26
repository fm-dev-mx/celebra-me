import { useCallback, useEffect, useState } from 'react';
import type { AdminEventListItemDTO } from '@/interfaces/dashboard/admin.interface';
import { adminApi } from '@/lib/dashboard/admin-api';
import type { CreateEventDTO, UpdateEventDTO } from '@/lib/dashboard/dto/events';

export type EventStatus = 'draft' | 'published' | 'archived';
export type EventType = 'xv' | 'boda' | 'bautizo' | 'cumple';

export function getEventStatusLabel(status: EventStatus): string {
	switch (status) {
		case 'draft':
			return 'Borrador';
		case 'published':
			return 'Publicado';
		case 'archived':
			return 'Archivado';
		default:
			return status;
	}
}

export function getEventTypeLabel(eventType: EventType): string {
	switch (eventType) {
		case 'xv':
			return 'XV años';
		case 'boda':
			return 'Boda';
		case 'bautizo':
			return 'Bautizo';
		case 'cumple':
			return 'Cumpleaños';
		default:
			return eventType;
	}
}

export function useEventsAdmin() {
	const [items, setItems] = useState<AdminEventListItemDTO[]>([]);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const loadEvents = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const result = await adminApi.listEvents();
			setItems(result.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error inesperado.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadEvents();
	}, [loadEvents]);

	const createEvent = useCallback(
		async (payload: CreateEventDTO) => {
			try {
				await adminApi.createEvent(payload);
				await loadEvents();
			} catch (err) {
				throw new Error(err instanceof Error ? err.message : 'Error al crear el evento.');
			}
		},
		[loadEvents],
	);

	const updateEvent = useCallback(
		async (eventId: string, payload: UpdateEventDTO) => {
			try {
				await adminApi.updateEvent(eventId, payload);
				await loadEvents();
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al actualizar el evento.',
				);
			}
		},
		[loadEvents],
	);

	const archiveEvent = useCallback(
		async (eventId: string) => {
			try {
				await adminApi.archiveEvent(eventId);
				await loadEvents();
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al archivar el evento.',
				);
			}
		},
		[loadEvents],
	);

	const publishEvent = useCallback(
		async (eventId: string) => {
			try {
				await adminApi.publishEvent(eventId);
				await loadEvents();
			} catch (err) {
				throw new Error(
					err instanceof Error ? err.message : 'Error al publicar el evento.',
				);
			}
		},
		[loadEvents],
	);

	return {
		items,
		error,
		loading,
		createEvent,
		updateEvent,
		archiveEvent,
		publishEvent,
		reloadEvents: loadEvents,
	};
}
