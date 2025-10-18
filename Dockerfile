FROM node:16-alpine AS base

WORKDIR /usr/app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Development stage
FROM base AS development
COPY . .
RUN yarn install --frozen-lockfile
EXPOSE 8082
CMD ["yarn", "dev:watch"]

# Build stage
FROM base AS builder
COPY src ./src
COPY tsconfig.json .eslintrc .prettierrc ./
RUN yarn build

# Production stage
FROM node:16-alpine AS production
WORKDIR /usr/app

# Copy package files and install only production dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Copy built application
COPY --from=builder /usr/app/dist ./dist

EXPOSE 8082
CMD ["yarn", "start"]