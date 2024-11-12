// src/backend/utilities/composeMiddlewares.ts

import type { Handler, Middleware } from '@/core/types/handlers';

/**
 * Composes multiple middlewares into a single handler function.
 *
 * Middlewares are applied in the order they are provided.
 *
 * @param handler - The final handler to be executed after all middlewares.
 * @param middlewares - An array of middleware functions.
 * @returns A handler with all middlewares applied.
 */
export function composeMiddlewares(handler: Handler, middlewares: Middleware[]): Handler {
	return middlewares.reduceRight((next, middleware) => middleware(next), handler);
}
