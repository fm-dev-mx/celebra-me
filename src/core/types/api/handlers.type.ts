// File: src/core/types/api/handlers.type.ts

/**
 * Represents a generic handler for API routes.
 *
 * @template ContextType - The type of the context object (default: any).
 * @returns A Response object or a Promise resolving to a Response.
 */
export type Handler<ContextType = any> = (context: ContextType) => Promise<Response> | Response;

/**
 * Represents a middleware function that wraps a handler.
 *
 * @template ContextType - The type of the context object (default: any).
 * @param handler - The handler to be wrapped by the middleware.
 * @returns A new handler with additional behavior.
 */
export type Middleware<ContextType = any> = (handler: Handler<ContextType>) => Handler<ContextType>;
