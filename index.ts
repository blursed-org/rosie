import { Client, GatewayIntentBits, Events } from "discord.js";
import { OpenAI } from "openai";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: Bun.env.UPSTASH_REDIS_REST_URL,
  token: Bun.env.UPSTASH_REDIS_REST_TOKEN,
});

const gpt = new OpenAI({
  apiKey: Bun.env.OPENAI_API_KEY,
  // baseURL: "https://api.perplexity.ai",
});

const client = new Client({
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
  ],
});

interface Message {
  role: "user" | "assistant";
  content: string;
}[];

const messages: Message[] = [];

async function updateData() {
  await redis.keys("message:*").then(async (keys) => {
    await Promise.all(
      keys.map(async (key) => {
        const id = key.split(":")[1];
        const message = await redis.get(key);
        const response = await redis.get(`response:${id}`);
        return { id, content: message, response };
      })
    ).then((data) => {
      data.forEach((message) => {
        messages.push(
          { role: "user", content: message.content as string },
          { role: "assistant", content: message.response as string }
        );
      });
    });
  });
}

setTimeout(updateData, 1000);

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith(">")) return;
  if(!message.content.startsWith(`<@${client.user!.id}>`)) return;

  console.time("gpt_generate")
  messages.push({ role: "user", content: message.content.slice(23) });
  const response = (
    await gpt.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages,
    })
  ).choices[0].message.content as string;
  console.timeEnd("gpt_generate")

  message.reply(response);
  await redis.set(`message:${message.id}`, message.content);
  await redis.set(`response:${message.id}`, response);
});

client.login(Bun.env.DISCORD_TOKEN);
