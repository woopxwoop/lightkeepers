FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_KEY
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_DSN

ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_KEY=$PUBLIC_SUPABASE_KEY
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV SENTRY_DSN=$SENTRY_DSN

RUN echo "PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL" > .env && \
    echo "PUBLIC_SUPABASE_KEY=$PUBLIC_SUPABASE_KEY" > .env && \
    echo "SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN" > env %% \
    echo "SENTRY_DSN=$SENTRY_DSN" >> .env
    
RUN pnpm build
RUN pnpm prune --prod

FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "build"]