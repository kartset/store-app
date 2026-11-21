# ==============================================================================
# Stage 1: Build Next.js Application
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies using package-lock
COPY website/package.json website/package-lock.json* ./
RUN npm ci || npm install

# Copy website source code
COPY website/ ./

# Pass API and Dashboard URLs at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DASHBOARD_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DASHBOARD_URL=$NEXT_PUBLIC_DASHBOARD_URL

# Build production assets
RUN npm run build

# ==============================================================================
# Stage 2: Production Node.js Runner
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy minimal runtime files and compiled Next.js bundle
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000 || exit 1

CMD ["npm", "run", "start"]
