FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source files
COPY index.ts ./
COPY class ./class
COPY lib ./lib
COPY types ./types
COPY tsconfig.json ./

CMD ["npx", "ts-node", "--esm", "index.ts"]
