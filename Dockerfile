# ============================================================================
# Stage 1: Build React + TypeScript Frontend SPA
# ============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ============================================================================
# Stage 2: Production PHP 8.2 + Yii2 REST API + Built React SPA
# ============================================================================
FROM php:8.2-cli-alpine

# Install required system packages and PHP extensions (PDO MySQL, PDO SQLite, mbstring, zip)
RUN apk add --no-cache \
    sqlite-libs \
    sqlite-dev \
    oniguruma-dev \
    libzip-dev \
    unzip \
    git \
    && docker-php-ext-install pdo pdo_mysql pdo_sqlite mbstring zip

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/flowforge/backend

# Install Backend Composer dependencies
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Copy Backend application code
COPY backend/ ./

# Copy built React SPA into backend/web/ so single server serves both UI and /api/v1/*
COPY --from=frontend-builder /app/frontend/dist/ ./web/

# Ensure runtime, assets, and uploads directories are writable
RUN mkdir -p runtime web/assets web/uploads/tasks && chmod -R 777 runtime web/assets web/uploads

# Startup script: runs migrations & seeds demo data on first boot, then starts server on $PORT
RUN printf '#!/bin/sh\nset -e\nphp yii migrate --interactive=0\nphp yii seed/run || true\nPORT="${PORT:-8080}"\necho "FlowForge Enterprise running on port $PORT"\nexec php -S 0.0.0.0:$PORT -t web web/router.php\n' > /usr/local/bin/start-flowforge.sh \
    && chmod +x /usr/local/bin/start-flowforge.sh

EXPOSE 8080
CMD ["/usr/local/bin/start-flowforge.sh"]
