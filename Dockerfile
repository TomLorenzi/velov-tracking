FROM node:20-alpine

WORKDIR /app

# Copy Prisma schema (needed by postinstall: prisma generate)
COPY prisma ./prisma

# Install dependencies + tsx
COPY package.json package-lock.json* ./
RUN npm install && npm install --save-dev tsx

# Copy source files
COPY index.ts ./
COPY class ./class
COPY lib ./lib
COPY types ./types
COPY tsconfig.json ./
COPY .env ./

CMD ["npx", "tsx", "index.ts"]
