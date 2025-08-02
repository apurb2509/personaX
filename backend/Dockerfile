# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Install the netcat utility
RUN apk add --no-cache netcat-openbsd

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Make the start script executable
RUN chmod +x ./start.sh

# The command to run your application
CMD [ "./start.sh" ]