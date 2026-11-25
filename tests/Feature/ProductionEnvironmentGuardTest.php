<?php

namespace Tests\Feature;

use App\Support\ProductionEnvironmentGuard;
use RuntimeException;
use Tests\TestCase;

class ProductionEnvironmentGuardTest extends TestCase
{
    private function configureProduction(string $driver, array $connection): void
    {
        config([
            'app.env' => 'production',
            'app.debug' => false,
            'app.url' => 'https://lms.example.test',
            'app.key' => 'base64:'.base64_encode(str_repeat('k', 32)),
            'session.secure' => true,
            'session.http_only' => true,
            'services.payment_webhook_secret' => 'a-long-dedicated-payment-webhook-secret',
            'database.default' => $driver,
            "database.connections.{$driver}" => $connection,
        ]);
    }

    public function test_production_accepts_local_database_with_secure_session_and_webhook_secret(): void
    {
        $this->configureProduction('sqlite', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'host' => 'localhost',
        ]);

        ProductionEnvironmentGuard::assertSecure();
        $this->assertTrue(true);
    }

    public function test_production_rejects_remote_mysql_without_verified_ca(): void
    {
        $this->configureProduction('mysql', [
            'driver' => 'mysql',
            'host' => 'db.example.test',
            'options' => [],
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Remote MySQL requires a readable CA certificate');
        ProductionEnvironmentGuard::assertSecure();
    }

    public function test_production_rejects_remote_postgres_without_verify_full_and_ca(): void
    {
        $this->configureProduction('pgsql', [
            'driver' => 'pgsql',
            'host' => 'db.example.test',
            'sslmode' => 'require',
            'sslrootcert' => '',
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Remote PostgreSQL requires DB_SSLMODE=verify-full');
        ProductionEnvironmentGuard::assertSecure();
    }

}
