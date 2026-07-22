FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

# Public client env only — baked into the browser bundle by design (anon key).
# Private secrets are injected at container runtime (see deploy.yml + compose).
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_KEY
ARG SENTRY_DSN

ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_KEY=$PUBLIC_SUPABASE_KEY
ENV SENTRY_DSN=$SENTRY_DSN
ENV PUBLIC_SENTRY_DSN=$SENTRY_DSN

# SENTRY_AUTH_TOKEN is build-only (source map upload); never ends up in the image.
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    echo "PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL" > .env && \
    echo "PUBLIC_SUPABASE_KEY=$PUBLIC_SUPABASE_KEY" >> .env && \
    echo "PUBLIC_SENTRY_DSN=$SENTRY_DSN" >> .env && \
    SENTRY_AUTH_TOKEN=$(cat /run/secrets/SENTRY_AUTH_TOKEN) pnpm build
RUN pnpm prune --prod

FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .

RUN npm install -g pm2

EXPOSE 3000
ENV NODE_ENV=production

CMD ["pm2-runtime", "build/index.js", "-i", "max"]
