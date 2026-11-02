FROM php:8.3-cli-alpine

RUN apk add --no-cache \
    zip unzip git curl libpng-dev libxml2-dev libzip-dev nginx \
    && docker-php-ext-install pdo pdo_mysql bcmath gd zip opcache

RUN printf '%s\n' \
    'opcache.enable=1' \
    'opcache.enable_cli=1' \
    'opcache.validate_timestamps=0' \
    'opcache.memory_consumption=96' \
    'opcache.max_accelerated_files=20000' \
    > /usr/local/etc/php/conf.d/opcache.ini

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

RUN apk add --no-cache nodejs npm

WORKDIR /var/www/html

COPY . .

RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader
RUN npm ci && npm run build

RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 10000

CMD php artisan migrate:fresh --force && php artisan migrate --force && php artisan db:seed --class=Database\\Seeders\\DatabaseSeeder --force && php artisan storage:link & php artisan serve --host=0.0.0.0 --port=${PORT:-10000}