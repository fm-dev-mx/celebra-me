/**
 * Validación de variables de entorno requeridas
 * Este módulo verifica que todas las variables críticas estén configuradas
 * al iniciar la aplicación.
 */

interface EnvRequirement {
	name: string;
	required: boolean;
	productionOnly?: boolean;
	description: string;
}

const REQUIRED_ENV_VARS: EnvRequirement[] = [
	// Base de datos - siempre requeridas
	{
		name: 'SUPABASE_URL',
		required: true,
		description: 'URL del proyecto Supabase',
	},
	{
		name: 'SUPABASE_ANON_KEY',
		required: true,
		description: 'Clave anónima de Supabase',
	},
	{
		name: 'SUPABASE_SERVICE_ROLE_KEY',
		required: true,
		description: 'Clave de service role de Supabase',
	},

	// Seguridad - siempre requeridas
	{
		name: 'TRUST_DEVICE_SECRET',
		required: true,
		description: 'Secret para tokens de dispositivo confiable',
	},
	{
		name: 'RSVP_CLAIM_CODE_PEPPER',
		required: true,
		description: 'Pepper para hash de claim codes',
	},
	{
		name: 'RSVP_TOKEN_SECRET',
		required: true,
		description: 'Secret para tokens RSVP',
	},

	// Rate limiting - requerido en producción
	{
		name: 'UPSTASH_REDIS_REST_URL',
		required: true,
		productionOnly: true,
		description: 'URL de Redis (Upstash)',
	},
	{
		name: 'UPSTASH_REDIS_REST_TOKEN',
		required: true,
		productionOnly: true,
		description: 'Token de Redis (Upstash)',
	},

	// Email - requerido en producción
	{
		name: 'GMAIL_USER',
		required: true,
		productionOnly: true,
		description: 'Usuario Gmail',
	},
	{
		name: 'GMAIL_PASS',
		required: true,
		productionOnly: true,
		description: 'Contraseña de aplicación Gmail',
	},
	{
		name: 'CONTACT_FORM_RECIPIENT_EMAIL',
		required: true,
		productionOnly: true,
		description: 'Email destino para formulario de contacto',
	},

	// Observabilidad - requerido en producción
	{
		name: 'SENTRY_DSN',
		required: true,
		productionOnly: true,
		description: 'DSN de Sentry para error tracking',
	},
	{
		name: 'SENTRY_AUTH_TOKEN',
		required: true,
		productionOnly: true,
		description: 'Token de autenticación de Sentry',
	},
	{
		name: 'SENDGRID_API_KEY',
		required: false,
		productionOnly: true,
		description: 'API key para SendGrid (alternativa SMTP)',
	},
	{
		name: 'TRUST_DEVICE_MAX_AGE_DAYS',
		required: true,
		productionOnly: false,
		description: 'Duración máxima en días para dispositivos de confianza',
	},
	{
		name: 'ENABLE_MFA',
		required: true,
		productionOnly: false,
		description: 'Feature flag para Multi-Factor Authentication',
	},
];

/**
 * Valida que todas las variables de entorno requeridas estén configuradas
 * @throws Error si falta alguna variable requerida
 */
export function validateRequiredEnv(): void {
	const isProduction = process.env.NODE_ENV === 'production';
	const missing: string[] = [];
	const missingProd: string[] = [];

	for (const envVar of REQUIRED_ENV_VARS) {
		const value = process.env[envVar.name];
		const isMissing = !value || value.trim() === '';

		if (envVar.productionOnly) {
			// Solo validar en producción
			if (isProduction && isMissing) {
				missingProd.push(`${envVar.name} (${envVar.description})`);
			}
		} else if (envVar.required && isMissing) {
			// Siempre requerido
			missing.push(`${envVar.name} (${envVar.description})`);
		}
	}

	if (missing.length > 0 || missingProd.length > 0) {
		let errorMessage = '❌ Error de configuración:\n\n';

		if (missing.length > 0) {
			errorMessage += 'Variables requeridas faltantes:\n';
			missing.forEach((v) => {
				errorMessage += `  • ${v}\n`;
			});
			errorMessage += '\n';
		}

		if (missingProd.length > 0) {
			errorMessage += 'Variables requeridas en producción:\n';
			missingProd.forEach((v) => {
				errorMessage += `  • ${v}\n`;
			});
			errorMessage += '\n';
		}

		errorMessage += 'Por favor, configura estas variables en tu archivo .env.local\n';
		errorMessage += 'o en el dashboard de Vercel (producción).\n\n';
		errorMessage += 'Consulta .env.example para más información.';

		throw new Error(errorMessage);
	}

	console.info('Variables de entorno validadas correctamente');
}

/**
 * Valida variables de entorno de forma asíncrona
 * Útil para usar en el middleware o punto de entrada
 */
export async function validateEnvAsync(): Promise<void> {
	try {
		validateRequiredEnv();
	} catch (error) {
		console.error(error);
		// En desarrollo, solo loggear el error
		// En producción, lanzar el error para detener el arranque
		if (process.env.NODE_ENV === 'production') {
			throw error;
		}
	}
}
