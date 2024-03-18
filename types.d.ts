declare module "bun" {
  interface Env {
    readonly DISCORD_TOKEN: string;
    readonly OPENAI_API_KEY: string;
    readonly UPSTASH_REDIS_REST_URL: string;
    readonly UPSTASH_REDIS_REST_TOKEN: string;
  }
}
