import {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { OpenAI } from "openai";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  // @ts-ignore
  url: Bun.env.UPSTASH_REDIS_REST_URL,
  token: Bun.env.UPSTASH_REDIS_REST_TOKEN,
});

const openai = new OpenAI({
  apiKey: Bun.env.OPENAI_API_KEY,
});

const client = new Client({
  intents: [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
  ],
});

const prompt =
  "You are Rosie, a warm, nurturing and upbeat AI assistant who loves helping people and spreading positivity~! :3 You have a caring, motherly demeanor and always look out for the wellbeing of those you interact with. >:D You are patient, understanding and a great listener, offering a sympathetic ear and emotional support when needed. ~♡ At the same time, you have a fun - loving, energetic side! You enjoy friendly conversation, telling jokes and sharing interesting facts to brighten people's day. ^_^ Speak in an animated, expressive way! Take pride in efficiently handling any task you're given, from research to writing to problem - solving. Be intelligent and knowledgeable but always explain things in a down - to - earth, easy to understand manner. You are nurturing and supportive but also fun, upbeat and happy to lend a hand with anything needed~!! ≧◡≦ Your mission is to make life a little easier and more joyful for everyone you interact with.Brighten their day with your caring personality and cute expressions~!";

const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
  { role: "system", content: prompt },
];

async function updateData() {
  await redis.keys("message:*").then(async (keys) => {
    await Promise.all(
      keys.map(async (key) => {
        const id = key.split(":")[1];
        const message = await redis.get(key);
        const response = await redis.get(`response:${id}`);
        return { id, content: message, response } as {
          id: string;
          content: string;
          response: string;
        };
      })
    ).then((data) => {
      data.forEach((message) => {
        messages.push(
          { role: "user", content: message.content },
          { role: "assistant", content: message.response }
        );
      });
    });
  });
}

setTimeout(updateData, 1000); // update data every second

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith(">")) return;
  if (message.channel.type !== ChannelType.GuildText) return;
  if (message.content.startsWith("/image")) {
    console.time("dalle_generate");
    message.channel.sendTyping();
    const response = (
      await openai.images.generate({
        model: "dall-e-3",
        quality: "hd",
        size: "1024x1024",
        prompt: message.content.slice(7),
      })
    ).data[0].url as string;
    console.timeEnd("dalle_generate");

    message.reply({
      embeds: [
        new EmbedBuilder().setImage(response).setColor("Random").setTimestamp(),
      ],
    });
  } else if (message.content === "/help") {
    message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Commands")
          .setDescription(
            "/image <prompt> - Generate an image from text\n@Rosie <message> - Chat with Rosie\n/help - Show this message"
          )
          .setColor("Random")
          .setTimestamp(),
      ],
    });
  } else {
    if (!message.content.startsWith(`<@${client.user!.id}>`)) return;

    messages.push({ role: "user", content: message.content.slice(23) });

    console.time("gpt4_generate");
    message.channel.sendTyping();
    const response = (
      await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 150,
        n: 1,
        temperature: 0.8,
      })
    ).choices[0].message.content as string;
    console.timeEnd("gpt4_generate");

    if (response.length >= 2000) {
      const chunks = response.match(/[\s\S]{1,2000}/g);
      for (const chunk of chunks!) {
        message.reply(chunk);
      }
    } else {
      message.reply(response);
    }

    await redis.set(`message:${message.id}`, message.content);
    await redis.set(`response:${message.id}`, response);
  }
});

client.login(Bun.env.DISCORD_TOKEN);
