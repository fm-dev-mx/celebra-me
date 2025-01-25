// src/core/types/api/apiResponse.type.ts

import { ApiErrorResponse, ApiSuccessResponse } from '@/core/interfaces/api/apiResponse.interface';

/**
 * Represents the shape of an API response, which can either be successful or contain an error.
 *
 * @template T - The type of the data payload in a successful response.
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
