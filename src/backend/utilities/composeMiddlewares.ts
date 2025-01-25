// src/backend/utilities/composeMiddlewares.ts

import { Handler, Middleware } from '@/core/types/api/handlers.type';

/**
 * Composes multiple middleware functions into a single handler.
 *
 * @param handler - The final handler to execute after all middleware.
 * @param middlewares - An array of middleware functions to apply.
 * @returns A composed handler with all middleware applied.
 */
export function composeMiddlewares(handler: Handler, middlewares: Middleware[]): Handler {
	return middlewares.reduceRight((next, middleware) => middleware(next), handler);
}
