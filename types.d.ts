declare module "bun" {
  interface Env {
    DISCORD_TOKEN: string;
    OPENAI_API_KEY: string;
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
  }
}
