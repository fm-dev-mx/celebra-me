// src/config/configSingleton.ts

class ConfigSingleton {
	private static instance: ConfigSingleton;
	public ENVIRONMENT: string;
	public REDIS_CONFIG: { url: string; token: string };
	public EMAIL_CONFIG: { sendgridApiKey: string; recipient: string; sender: string };

	private constructor() {
		this.ENVIRONMENT = process.env.NODE_ENV || import.meta.env.NODE_ENV || 'development';
		this.REDIS_CONFIG = {
			url: this.getEnvVariable('REDIS_URL'),
			token: this.getEnvVariable('REDIS_TOKEN'),
		};
		this.EMAIL_CONFIG = {
			sendgridApiKey: this.getEnvVariable('SENDGRID_API_KEY'),
			recipient: this.getEnvVariable('RECIPIENT_EMAIL'),
			sender: this.getEnvVariable('SENDER_EMAIL'),
		};
	}

	public static getInstance(): ConfigSingleton {
		if (!ConfigSingleton.instance) {
			ConfigSingleton.instance = new ConfigSingleton();
		}
		return ConfigSingleton.instance;
	}

	private getEnvVariable(key: string): string {
		const value = this.ENVIRONMENT === 'production'
			? process.env[key]
			: import.meta.env[key];

		if (this.ENVIRONMENT === 'development') {
			console.log(`${key} (process.env):`, process.env[key]);
			console.log(`${key} (import.meta.env):`, import.meta.env[key]);
		}

		if (!value) {
			if (this.ENVIRONMENT === 'development') {
				console.warn(`Environment variable ${key} is missing.`);
			} else {
				throw new Error(`Environment variable ${key} is missing.`);
			}
		}

		return value || '';
	}
}

export default ConfigSingleton.getInstance();
