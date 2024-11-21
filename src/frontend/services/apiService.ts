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
			const response = await fetch('/api/contact-form-submissions', jsonPost(data));

			if (!response.ok) {
				// Handle HTTP errors
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to send contact form');
			}

			return response.json();
		} catch (error) {
			// Handle network errors or parsing errors
			throw new Error(error instanceof Error ? error.message : 'Unknown error occurred');
		}
	}
}

export const apiService = new ApiService();
