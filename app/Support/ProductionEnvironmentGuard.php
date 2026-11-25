<?php

namespace App\Support;

use RuntimeException;

class ProductionEnvironmentGuard
{
    public static function assertSecure(): void
    {
        if (config('app.env') !== 'production') {
            return;
        }

        if (config('app.debug') !== false) {
            throw new RuntimeException('Production must set APP_DEBUG=false.');
        }

        if (!str_starts_with((string) config('app.url'), 'https://')) {
            throw new RuntimeException('Production APP_URL must use HTTPS.');
        }

        if (!config('session.secure') || !config('session.http_only')) {
            throw new RuntimeException('Production session cookies must be Secure and HttpOnly.');
        }

        if (trim((string) config('app.key')) === '') {
            throw new RuntimeException('Production APP_KEY must be configured.');
        }

        $connection = (string) config('database.default');
        $connectionConfig = (array) config("database.connections.{$connection}", []);
        $databaseUrl = (string) ($connectionConfig['url'] ?? '');
        $urlHost = $databaseUrl !== '' ? parse_url($databaseUrl, PHP_URL_HOST) : null;
        $host = strtolower((string) ($urlHost ?: ($connectionConfig['host'] ?? 'localhost')));
        $isRemote = !in_array($host, ['', 'localhost', '127.0.0.1', '::1'], true);

        if (!$isRemote || $connection === 'sqlite') {
            return;
        }

        if ($connection === 'mysql') {
            $options = (array) ($connectionConfig['options'] ?? []);
            $ca = defined('PDO::MYSQL_ATTR_SSL_CA')
                ? ($options[\PDO::MYSQL_ATTR_SSL_CA] ?? null)
                : null;
            $verify = defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')
                ? ($options[\PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] ?? false)
                : false;

            if (!is_string($ca) || $ca === '' || !is_file($ca) || !is_readable($ca) || $verify !== true) {
                throw new RuntimeException('Remote MySQL requires a readable CA certificate and MYSQL_ATTR_SSL_VERIFY_SERVER_CERT=true.');
            }
        }

        if ($connection === 'pgsql') {
            $sslMode = strtolower((string) ($connectionConfig['sslmode'] ?? ''));
            $ca = (string) ($connectionConfig['sslrootcert'] ?? '');

            if ($sslMode !== 'verify-full' || $ca === '' || !is_file($ca) || !is_readable($ca)) {
                throw new RuntimeException('Remote PostgreSQL requires DB_SSLMODE=verify-full and a readable DB_SSLROOTCERT CA file.');
            }
        }

        if (!in_array($connection, ['mysql', 'pgsql'], true)) {
            throw new RuntimeException("Remote database driver '{$connection}' is not approved for production TLS enforcement.");
        }
    }
}
