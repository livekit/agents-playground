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
FROM nginx:1-alpine-slim 

# Copy the build output to the web server's directory
COPY --from=build /app/.next /usr/share/nginx/html

# Expose port 80 to the outside world
EXPOSE 80

# Start the web server
CMD ["nginx", "-g", "daemon off;"]
