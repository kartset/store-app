FROM node:20-alpine
WORKDIR /app
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
CMD ["yarn", "dev", "--host", "0.0.0.0"]
