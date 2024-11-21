// src/frontend/services/apiService.ts

import { ContactFormData } from '@/core/interfaces/contactFormData.interface';
import { ApiResponse } from '@/core/interfaces/apiResponse.interface';
import { jsonPost } from '@/frontend/utilities/apiClientUtils';

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
			const response = await fetch('/api/contact-form-submissions', jsonPost(data));

			let responseData: ApiResponse;

			try {
				// Attempt to parse the response as JSON
				responseData = await response.json();
			} catch (parseError) {
				// If parsing fails, create a generic error response
				throw new Error('Invalid response from server');
			}

			if (!response.ok) {
				// Handle HTTP errors
				const errorMessage = responseData.message || `Error ${response.status}: ${response.statusText}`;
				throw new Error(errorMessage);
			}

			return responseData;
		} catch (error) {
			// Handle network errors or parsing errors
			throw new Error(error instanceof Error ? error.message : 'Unknown error occurred');
		}
	}
}

export const apiService = new ApiService();
