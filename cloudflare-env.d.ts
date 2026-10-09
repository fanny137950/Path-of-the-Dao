declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    AUTH_MODE?: 'standalone' | 'sites';
    GAME_OWNER_ID?: string;
    GAME_LOGIN_PASSWORD?: string;
    GAME_SESSION_SECRET?: string;
    GAME_DEVELOPER_USER_IDS?: string;
    BUCKET?: R2Bucket;
  }
}
