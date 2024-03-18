FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lockb ./

RUN bun install --frozen-lockfile --production

COPY . .

ENV NODE_ENV=production

ENTRYPOINT [ "bun", "run", "index.ts" ]
