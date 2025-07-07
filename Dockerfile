# hadolint ignore=DL3002,DL3003
# Use official Node.js LTS version as a parent image
ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION}

# Build arguments for environment variables (pass these at build time)
ARG TELEGRAM_BOT_TOKEN
ARG TELEGRAM_CHAT_ID
ARG SERCARGO_USER_TOKEN
ARG SERCARGO_USER_LOCKER
ARG PORT=3000

# Expose health-check port
EXPOSE ${PORT}

# Set environment variables inside the container
ENV TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN} \
    TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID} \
    SERCARGO_USER_TOKEN=${SERCARGO_USER_TOKEN} \
    SERCARGO_USER_LOCKER=${SERCARGO_USER_LOCKER} \
    PORT=${PORT}

# Set working directory
WORKDIR /usr/src/app

# Copy package manifest and TypeScript config for dependency installation
COPY package.json package-lock.json tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application source
COPY . .

# Create .env file from build-time arguments/env inside container
RUN echo "TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}" > .env && \
    echo "TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}" >> .env && \
    echo "SERCARGO_USER_TOKEN=${SERCARGO_USER_TOKEN}" >> .env && \
    echo "SERCARGO_USER_LOCKER=${SERCARGO_USER_LOCKER}" >> .env && \
    echo "PORT=${PORT}" >> .env

# Default command to run the service
CMD ["npm", "start"]
