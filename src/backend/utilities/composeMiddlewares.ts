// src/backend/utilities/composeMiddlewares.ts

import type { Handler, Middleware } from '@/core/types/handlers.d';

/**
 * Composes multiple middlewares into a single handler function.
 *
 * @param handler - The final handler to be executed after all middlewares.
 * @param middlewares - An array of middleware functions.
 * @returns A handler with all middlewares applied.
 */
export function composeMiddlewares(handler: Handler, middlewares: Middleware[]): Handler {
	return middlewares.reduce((next, middleware) => middleware(next), handler);
}
