# Use the official Node.js image as the base image
FROM node:18.17.0 AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the project dependencies
RUN npm install

# Copy the rest of the project files to the working directory
COPY . .

# Build the React app
RUN npm run build

# Use a lightweight web server to serve the static files
FROM node:18.17.0-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the build output to the working directory
COPY --from=build /app ./

# Install only production dependencies
RUN npm install --only=production

# Expose port 3000 to the outside world
EXPOSE 3000

# Start the Next.js server
CMD ["npm", "start"]