FROM node:24-alpine
WORKDIR /app

# Install workspace deps from the repo root (single lockfile).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci --include=dev

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w apps/api

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["npm", "start", "-w", "apps/api"]
