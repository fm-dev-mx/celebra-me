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
		const response = await fetch('/api/sendContactForm', jsonPost(data));

		return response.json();
	}
}

export const apiService = new ApiService();
