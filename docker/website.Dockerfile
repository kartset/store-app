FROM node:20-alpine
WORKDIR /app
COPY website/package.json website/package-lock.json* ./
RUN npm install
COPY website/ ./
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000
CMD ["npm", "run", "dev"]
