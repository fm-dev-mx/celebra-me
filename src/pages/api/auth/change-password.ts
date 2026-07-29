import type { APIRoute } from 'astro';
import { ApiError } from '@/lib/rsvp/core/errors';
import { errorResponse, parseJsonBody } from '@/lib/rsvp/core/http';
import {
	adminSetUserMustChangePassword,
	signInWithPassword,
	updateUserPasswordUserAuth,
} from '@/lib/rsvp/auth/auth-api';
import { requireSessionContext } from '@/lib/rsvp/auth/auth';
import {
	buildIdleActivityCookie,
	buildRefreshTokenCookie,
	buildSessionCookie,
} from '@/lib/rsvp/auth/cookies';
import { resolveDashboardHome } from '@/lib/rsvp/auth/roles';
import {
	assertSameOrigin,
	assertValidPassword,
	enforceAuthRateLimit,
	sanitizePassword,
} from '@/lib/rsvp/security/auth-security';
import { ChangePasswordSchema } from '@/lib/schemas';

export const POST: APIRoute = async ({ request, url }) => {
	try {
		assertSameOrigin(request, url.origin);

		const session = await requireSessionContext(request);
		await enforceAuthRateLimit({
			request,
			entityId: `change_password:${session.userId}`,
			maxHits: 6,
			windowSec: 60,
		});

		const bodyResult = await parseJsonBody(request);
		if (bodyResult instanceof Response) return bodyResult;

		const parsedResult = ChangePasswordSchema.safeParse(bodyResult);
		if (!parsedResult.success) {
			const issue = parsedResult.error.issues[0];
			throw new ApiError(400, 'bad_request', issue?.message || 'Datos de contraseña inválidos.');
		}
		const { currentPassword, newPassword } = parsedResult.data;

		const sanitizedCurrent = sanitizePassword(currentPassword);
		const sanitizedNew = sanitizePassword(newPassword);
		assertValidPassword(sanitizedNew);

		// Step 1: Verify current password
		try {
			await signInWithPassword({
				email: session.email,
				password: sanitizedCurrent,
			});
		} catch {
			throw new ApiError(401, 'unauthorized', 'La contraseña actual es incorrecta.');
		}

		// Step 2: Update user password via authenticated user endpoint
		try {
			await updateUserPasswordUserAuth({
				accessToken: session.accessToken,
				password: sanitizedNew,
			});
		} catch (cause) {
			console.error('[change-password] failed user password update:', cause);
			throw new ApiError(400, 'password_update_failed', 'No se pudo actualizar la contraseña en el servicio de autenticación.');
		}

		// Step 3: Clear must_change_password flag in app_metadata via admin endpoint (fail-closed)
		try {
			await adminSetUserMustChangePassword({
				userId: session.userId,
				mustChangePassword: false,
			});
		} catch (cause) {
			console.error('[change-password] failed clearing must_change_password flag:', cause);
			throw new ApiError(500, 'metadata_update_failed', 'La contraseña se actualizó pero no se pudo desbloquear la sesión. Intenta de nuevo.');
		}

		// Step 4: Re-authenticate to issue fresh session tokens with updated app_metadata
		const freshAuth = await signInWithPassword({
			email: session.email,
			password: sanitizedNew,
		});

		const payload = {
			ok: true,
			message: 'Contraseña actualizada con éxito.',
			next: resolveDashboardHome(session.role),
		};

		const headers = new Headers({ 'Content-Type': 'application/json' });
		headers.append('Set-Cookie', buildSessionCookie(freshAuth.access_token));
		headers.append('Set-Cookie', buildIdleActivityCookie(Math.floor(Date.now() / 1000)));
		if (freshAuth.refresh_token) {
			headers.append('Set-Cookie', buildRefreshTokenCookie(freshAuth.refresh_token));
		}

		return new Response(JSON.stringify(payload), {
			status: 200,
			headers,
		});
	} catch (error: unknown) {
		if (error instanceof SyntaxError) {
			return errorResponse(new ApiError(400, 'bad_request', 'JSON inválido.'));
		}
		return errorResponse(error);
	}
};
