/**
 * Project-agnostic board constants and enumerations.
 * Pure constants only: no imports, no Node APIs.
 */
export const URGENCIAS = ['urgente', 'alta', 'normal', 'baja'];
export const ACTORES = ['dueno', 'sesion', 'coordinador'];
export const AGENT_REGISTRY = {
	claude: {
		nombre: 'Claude',
		capacidades: ['codigo', 'git', 'gh', 'navegador', 'artifact', 'sesiones'],
	},
	codex: { nombre: 'Codex', capacidades: ['codigo', 'git', 'gh'] },
	gemini: { nombre: 'Gemini', capacidades: ['codigo', 'git', 'gh', 'imagenes'] },
};
export const AGENTES = [...Object.keys(AGENT_REGISTRY), 'cualquiera'];
export const CLAUDE_SESSION_ENV = 'CLAUDE_CODE_HOST_SESSION_ID';
export const CLAUDE_SESSION_PREFIX = 'local_';

export const TOCA = ['main', 'produccion', 'migracion', 'secretos'];
export const REQUISITOS = ['tarea', 'decision', 'fecha', 'dueno', 'revision'];
export const ESTADOS = [
	'pendiente',
	'bloqueada',
	'en curso',
	'en revision',
	'hecha',
	'unida',
	'comprobada',
	'cancelada',
];
export const STAGES = ['bloqueada', 'lista', 'curso', 'revision', 'hecha'];

export const QUIEN = ['claude', 'codex', 'gemini', 'coordinador', 'dueno'];
export const DESTINOS = ['coordinador', 'dueno', 'codex', 'gemini', 'claude'];
export const ATENDIBLES = ['dueno', 'coordinador'];

export const VEREDICTOS = ['aprobado', 'cambios', 'bloqueado'];
export const NIVELES = ['validate:changed', 'type-check', 'ci'];
export const TIPOS = [
	'codigo',
	'revision',
	'release',
	'invitacion',
	'creativo',
	'auditoria',
	'operacion',
];

export const RESULT_FIELDS = {
	codigo: ['pr', 'sha', 'nivel'],
	revision: ['veredicto', 'sha', 'hallazgos'],
};

export const HANDOFF_LISTS = [
	['fallidas', 'fallida'],
	['riesgos', 'riesgo'],
	['dudas', 'duda'],
	['excepcion', 'excepcion'],
];

export const READONLY_LANE = 'integration';
/** Session-title prefix of Integration (Win + F5); Win + F4 is the separate board project. */
export const INTEGRATION_SHORT = 'f05';
/** Coordinator, master and review sessions titled before the move from F4 to F5. */
export const LEGACY_INTEGRATION_SHORT = 'f04';
export const EXTERNAL_LANE = 'externo';

export const CATEGORIA_CARRIL = {
	plataforma: 'f05-plataforma',
	landing: 'f06-landing',
	invitaciones: 'f07-invitaciones',
	demos: 'f08-demos',
	docs: 'f09-docs',
	herramientas: 'f10-libre',
	preview: 'f11-preview',
	release: 'f12-release',
};
export const CATEGORIAS = Object.keys(CATEGORIA_CARRIL);
