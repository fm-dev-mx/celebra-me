import { ApiError, isApiError } from '@/lib/rsvp/core/errors';

export type PublicationFeedback =
	| { state: 'idle' }
	| { state: 'success'; message: string }
	| {
			state: 'error';
			message: string;
			guidance: string;
			retryable: boolean;
	  };

function reasonOf(error: ApiError): string | undefined {
	return typeof error.details?.reason === 'string' ? error.details.reason : undefined;
}

/** Maps the server error contract to copy that is safe to show in the publish dialog. */
export function getPublicationFeedback(error: unknown): PublicationFeedback {
	if (!isApiError(error)) {
		return {
			state: 'error',
			message: 'No se pudo conectar para publicar los cambios.',
			guidance:
				'Verifica tu conexión e inténtalo de nuevo. Tus cambios guardados no se han perdido.',
			retryable: true,
		};
	}

	const reason = reasonOf(error);
	if (reason === 'publish_stale_draft') {
		return {
			state: 'error',
			message: 'El borrador cambió antes de terminar la publicación.',
			guidance:
				'Cierra este mensaje, recarga el editor y revisa los cambios antes de volver a publicar.',
			retryable: false,
		};
	}
	if (reason === 'publish_stale_public_metadata' || reason === 'publish_stale_published') {
		return {
			state: 'error',
			message: 'La información pública cambió antes de terminar la publicación.',
			guidance:
				'Cierra este mensaje, recarga el editor y solicita una nueva revisión antes de publicar.',
			retryable: false,
		};
	}
	if (reason === 'publish_idempotency_key_reused') {
		return {
			state: 'error',
			message: 'Esta confirmación ya se usó con una revisión distinta.',
			guidance: 'Cierra este mensaje y solicita una nueva revisión de publicación.',
			retryable: false,
		};
	}
	if (reason === 'publish_upgrade_required') {
		return {
			state: 'error',
			message: 'La publicación está temporalmente en mantenimiento.',
			guidance: 'No repitas la acción. Actualiza el editor o vuelve a intentarlo más tarde.',
			retryable: false,
		};
	}
	if (error.code === 'validation_error' || error.code === 'bad_request') {
		return {
			state: 'error',
			message: 'Hay datos que necesitan corrección antes de publicar.',
			guidance:
				'Cierra este mensaje, revisa los campos señalados y solicita una nueva revisión.',
			retryable: false,
		};
	}
	if (error.code === 'rate_limited' || error.status >= 500) {
		return {
			state: 'error',
			message: 'No fue posible confirmar la publicación en este momento.',
			guidance:
				'Espera un momento e inténtalo de nuevo. El mismo intento es seguro y no crea otra versión.',
			retryable: true,
		};
	}
	return {
		state: 'error',
		message: 'No se pudieron publicar los cambios.',
		guidance: 'Cierra este mensaje, recarga el editor y vuelve a revisar antes de publicar.',
		retryable: false,
	};
}
