# --- Build Stage ---
    FROM node:18-alpine AS build
    WORKDIR /app
    COPY package*.json ./
    RUN npm install
    COPY . .
    RUN npm run build
    
    # --- Serve Stage ---
    FROM nginx:stable-alpine
    # Copy the static files from the build stage
    COPY --from=build /app/dist /usr/share/nginx/html
    # Copy our custom nginx configuration
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    # Expose port 80 to the outside world
    EXPOSE 80
    # Command to start nginx
    CMD ["nginx", "-g", "daemon off;"]