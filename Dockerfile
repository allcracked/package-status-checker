# Use official Node.js LTS version as a parent image
ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION}

# Set working directory
WORKDIR /usr/src/app

# Copy package manifest and TypeScript config for dependency installation
COPY package.json package-lock.json tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application source
COPY . .

# Default command to run the service
CMD ["npm", "start"]
