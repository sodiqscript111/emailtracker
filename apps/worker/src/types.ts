export interface WorkerEnv {
  DB: D1Database;
  API_AUTH_TOKEN?: string;
  IP_SALT?: string;
  BASE_URL?: string;
  ALLOWED_ORIGINS?: string;
}
