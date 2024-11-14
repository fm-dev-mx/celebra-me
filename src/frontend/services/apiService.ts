// src/frontend/services/apiService.ts

import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { ApiErrorResponse, ApiResponse } from '@/core/interfaces/apiResponse.interface';
import { jsonPost } from '@/core/config/constants';

/**
 * ApiService class handles API interactions.
 */
class ApiService {
	/**
	 * Sends contact form data to the backend API.
	 * @param data - The contact form data to send.
	 * @returns A promise resolving to the API response.
	 */
	public async sendContactForm(data: ContactFormData): Promise<ApiResponse> {
		try {
			const response = await fetch('/api/sendEmail', jsonPost(data));

			let responseData: ApiResponse;

			try {
				// Attempt to parse the response as JSON
				responseData = await response.json();
			} catch (parseError) {
				// If parsing fails, throw a generic error
				throw { error: 'Invalid response from server.' };
			}

			if (!response.ok) {
				// Throw the response data as an error if response is not ok
				throw responseData;
			}

			return responseData; // Successful response
		} catch (error) {
			// Handle network or unexpected errors
			if (error instanceof TypeError) {
				// Network error or similar
				throw { error: 'Network error. Please try again later.' };
			}

			// If error has 'error' property, assume it's an ApiErrorResponse
			if ((error as ApiErrorResponse).error) {
				// Return or throw a standardized error object
				throw error;
			} else {
				// Return a generic error message in the expected format
				throw { error: 'Hubo un error al enviar el formulario. Por favor, inténtalo de nuevo.' };
			}
		}
	}
}

export const apiService = new ApiService();
