FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_KEY
ARG SENTRY_DSN

ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_KEY=$PUBLIC_SUPABASE_KEY
ENV SENTRY_DSN=$SENTRY_DSN

RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    --mount=type=secret,id=PRIVATE_SUPABASE_KEY \
    --mount=type=secret,id=DATABASE_URL \
    --mount=type=secret,id=BETTER_AUTH_SECRET \
    --mount=type=secret,id=GOOGLE_CLIENT_ID \
    --mount=type=secret,id=GOOGLE_CLIENT_SECRET \
    --mount=type=secret,id=DISCORD_CLIENT_ID \
    --mount=type=secret,id=DISCORD_CLIENT_SECRET \
    echo "PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL" > .env && \
    echo "PUBLIC_SUPABASE_KEY=$PUBLIC_SUPABASE_KEY" >> .env && \
    echo "PUBLIC_SENTRY_DSN=$SENTRY_DSN" >> .env && \
    echo "PRIVATE_SUPABASE_KEY=$(cat /run/secrets/PRIVATE_SUPABASE_KEY)" >> .env && \
    echo "DATABASE_URL=$(cat /run/secrets/DATABASE_URL)" >> .env && \
    echo "BETTER_AUTH_SECRET=$(cat /run/secrets/BETTER_AUTH_SECRET)" >> .env && \
    echo "GOOGLE_CLIENT_ID=$(cat /run/secrets/GOOGLE_CLIENT_ID)" >> .env && \
    echo "GOOGLE_CLIENT_SECRET=$(cat /run/secrets/GOOGLE_CLIENT_SECRET)" >> .env && \
    echo "DISCORD_CLIENT_ID=$(cat /run/secrets/DISCORD_CLIENT_ID)" >> .env && \
    echo "DISCORD_CLIENT_SECRET=$(cat /run/secrets/DISCORD_CLIENT_SECRET)" >> .env && \
    SENTRY_AUTH_TOKEN=$(cat /run/secrets/SENTRY_AUTH_TOKEN) pnpm build
RUN pnpm prune --prod

FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENV NODE_ENV=production
ENV IMMUTABLE_ASSETS_DIR=/data/immutable
ENV IMMUTABLE_RETENTION_HOURS=48

ENTRYPOINT ["/entrypoint.sh"]