FROM node:20-alpine

WORKDIR /app

# Install dependencies + tsx
COPY package.json package-lock.json* ./
RUN npm install && npm install --save-dev tsx

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source files
COPY index.ts ./
COPY class ./class
COPY lib ./lib
COPY types ./types
COPY tsconfig.json ./

CMD ["npx", "tsx", "index.ts"]
