// src/frontend/services/apiService.ts

import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { ApiResponse } from '@/core/interfaces/apiResponse.interface';
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
				throw { success: false, message: 'Invalid response from server.' };
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
				throw { success: false, message: 'Network error. Please try again later.' };
			}

			// If error is already in ApiErrorResponse format, rethrow it
			if ((error as ApiResponse).success === false) {
				throw error;
			} else {
				// Return a generic error message in the expected format
				throw { success: false, message: 'Hubo un error al enviar el formulario. Por favor, inténtalo de nuevo.' };
			}
		}
	}
}

export const apiService = new ApiService();
