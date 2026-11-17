# ==============================================================================
# Stage 1: Build React Application
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies using yarn frozen lockfile
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy frontend source code
COPY frontend/ ./

# Pass API URL at build time so Vite can embed it in static assets
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build production assets
RUN yarn build

# ==============================================================================
# Stage 2: Serve Production Assets with Nginx & Gzip
# ==============================================================================
FROM nginx:alpine

# Remove default nginx HTML files
RUN rm -rf /usr/share/nginx/html/*

# Copy built static artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with gzip and SPA routing
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
