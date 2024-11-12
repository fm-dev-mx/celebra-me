// src/core/types/handlers.d.ts

import type { ContactFormAPIContext } from '@/core/interfaces/contactFormAPIContext.interface';

export type Handler = (context: ContactFormAPIContext) => Promise<Response> | Response;
export type Middleware = (handler: Handler) => Handler;
