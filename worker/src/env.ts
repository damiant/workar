export interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  ZEPTOMAIL_TOKEN: string;
  FROM_EMAIL: string;
  /** Override ZeptoMail endpoint — use https://api.zeptomail.eu/v1.1/email for EU accounts */
  ZEPTOMAIL_API_URL?: string;
}
