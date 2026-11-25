<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\BrandSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PDO;

class InstallController extends Controller
{
    public function index()
    {
        if (file_exists(storage_path('installed.lock'))) {
            return redirect()->route('home');
        }

        $requirements = [
            'php_8_3_plus' => version_compare(PHP_VERSION, '8.3.0', '>='),
            'pdo_sqlite' => extension_loaded('pdo_sqlite'),
            'pdo_mysql' => extension_loaded('pdo_mysql'),
            'zip_archive' => extension_loaded('zip'),
            'mbstring' => extension_loaded('mbstring'),
            'openssl' => extension_loaded('openssl'),
            'storage_writable' => is_writable(storage_path()),
            'cache_writable' => is_writable(base_path('bootstrap/cache')),
        ];

        return view('install.wizard', compact('requirements'));
    }

    public function install(Request $request)
    {
        if (file_exists(storage_path('installed.lock'))) {
            return redirect()->route('home');
        }

        $data = $request->validate([
            'company_name' => 'required|string|max:120',
            'tagline' => 'nullable|string|max:180',
            'app_url' => 'required|url',
            'support_email' => 'required|email|max:140',
            'support_phone' => 'nullable|string|max:40',
            'office_address' => 'nullable|string|max:240',
            'currency_symbol' => 'required|string|max:8',
            'roll_prefix' => 'required|string|max:12|alpha_num',
            'primary_color' => 'nullable|regex:/^#[0-9A-Fa-f]{6}$/',
            'accent_color' => 'nullable|regex:/^#[0-9A-Fa-f]{6}$/',
            'logo_file' => 'nullable|file|mimes:png,jpg,jpeg,webp,svg|max:4096',
            'db_connection' => 'required|in:sqlite,mysql,pgsql',
            'db_host' => 'nullable|string|max:120',
            'db_port' => 'nullable|numeric',
            'db_database' => 'required|string|max:180',
            'db_username' => 'nullable|string|max:120',
            'db_password' => 'nullable|string|max:200',
            'db_sslmode' => 'nullable|in:disable,prefer,require,verify-ca,verify-full',
            'admin_name' => 'required|string|max:120',
            'admin_email' => 'required|email|max:140',
            'admin_password' => 'required|string|min:8',
        ]);

        $driver = $data['db_connection'];
        $dbDatabaseValue = trim($data['db_database']);
        $sslMode = (string) ($data['db_sslmode'] ?? 'prefer');
        $isHttps = str_starts_with(strtolower(trim($data['app_url'])), 'https://');

        if ($driver === 'sqlite') {
            $sqlitePath = str_starts_with($dbDatabaseValue, '/')
                ? $dbDatabaseValue
                : database_path($dbDatabaseValue === '' ? 'database.sqlite' : basename($dbDatabaseValue));
            if (!str_ends_with($sqlitePath, '.sqlite')) {
                $sqlitePath .= '.sqlite';
            }
            $sqliteDir = dirname($sqlitePath);
            if (!is_dir($sqliteDir)) {
                mkdir($sqliteDir, 0755, true);
            }
            if (!is_file($sqlitePath)) {
                touch($sqlitePath);
            }
            try {
                new PDO('sqlite:' . $sqlitePath);
            } catch (\Throwable $e) {
                return back()->withInput()->withErrors(['db' => 'SQLite initialization failed: ' . $e->getMessage()]);
            }
            $dbDatabaseValue = $sqlitePath;
        } else {
            $host = trim((string) ($data['db_host'] ?? '127.0.0.1'));
            $port = (int) ($data['db_port'] ?? ($driver === 'pgsql' ? 5432 : 3306));
            $user = trim((string) ($data['db_username'] ?? 'root'));
            $pass = (string) ($data['db_password'] ?? '');

            try {
                $dsn = $driver === 'pgsql'
                    ? "pgsql:host={$host};port={$port};dbname={$dbDatabaseValue};sslmode={$sslMode}"
                    : "mysql:host={$host};port={$port};dbname={$dbDatabaseValue};charset=utf8mb4";
                new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            } catch (\Throwable $e) {
                return back()->withInput()->withErrors(['db' => 'Database connection failed: ' . $e->getMessage()]);
            }
        }

        $appKey = 'base64:' . base64_encode(random_bytes(32));
        $envLines = [
            'APP_NAME="' . addslashes($data['company_name']) . '"',
            'APP_ENV=production',
            'APP_KEY=' . $appKey,
            'APP_DEBUG=false',
            'APP_URL=' . rtrim($data['app_url'], '/'),
            'DB_CONNECTION=' . $driver,
        ];

        if ($driver === 'sqlite') {
            $envLines[] = 'DB_DATABASE="' . addslashes($dbDatabaseValue) . '"';
        } else {
            $envLines[] = 'DB_HOST=' . trim((string) ($data['db_host'] ?? '127.0.0.1'));
            $envLines[] = 'DB_PORT=' . (int) ($data['db_port'] ?? ($driver === 'pgsql' ? 5432 : 3306));
            $envLines[] = 'DB_DATABASE="' . addslashes($dbDatabaseValue) . '"';
            $envLines[] = 'DB_USERNAME="' . addslashes((string) ($data['db_username'] ?? 'root')) . '"';
            $envLines[] = 'DB_PASSWORD="' . addslashes((string) ($data['db_password'] ?? '')) . '"';
            $envLines[] = 'DB_SSLMODE=' . $sslMode;
        }

        $envLines[] = 'SESSION_DRIVER=database';
        $envLines[] = 'SESSION_ENCRYPT=true';
        $envLines[] = 'SESSION_HTTP_ONLY=true';
        $envLines[] = 'SESSION_SAME_SITE=lax';
        $envLines[] = 'SESSION_SECURE_COOKIE=' . ($isHttps ? 'true' : 'false');
        $envLines[] = 'CACHE_STORE=database';
        $envLines[] = 'QUEUE_CONNECTION=database';

        file_put_contents(base_path('.env'), implode("\n", $envLines) . "\n");

        config([
            'app.name' => $data['company_name'],
            'app.key' => $appKey,
            'app.url' => rtrim($data['app_url'], '/'),
            'database.default' => $driver,
            'session.encrypt' => true,
            'session.secure' => $isHttps,
        ]);

        if ($driver === 'sqlite') {
            config(['database.connections.sqlite.database' => $dbDatabaseValue]);
        } else {
            config([
                "database.connections.{$driver}.host" => trim((string) ($data['db_host'] ?? '127.0.0.1')),
                "database.connections.{$driver}.port" => (int) ($data['db_port'] ?? ($driver === 'pgsql' ? 5432 : 3306)),
                "database.connections.{$driver}.database" => $dbDatabaseValue,
                "database.connections.{$driver}.username" => (string) ($data['db_username'] ?? 'root'),
                "database.connections.{$driver}.password" => (string) ($data['db_password'] ?? ''),
                "database.connections.pgsql.sslmode" => $sslMode,
            ]);
        }
        DB::purge($driver);
        DB::setDefaultConnection($driver);

        // Non-destructive incremental migration (never wipe/drop existing tables or seed demo data)
        Artisan::call('migrate', ['--force' => true]);

        $logoPath = 'images/default-logo.svg';
        if ($request->hasFile('logo_file')) {
            $logoPath = BrandSettings::storeUploadedImage($request->file('logo_file'), 'company-logo');
        }

        BrandSettings::save([
            'company_name' => $data['company_name'],
            'tagline' => $data['tagline'] ?: 'Online & Campus Learning Management Platform',
            'support_email' => $data['support_email'],
            'support_phone' => $data['support_phone'] ?? '',
            'office_address' => $data['office_address'] ?? '',
            'currency_symbol' => $data['currency_symbol'],
            'roll_prefix' => strtoupper($data['roll_prefix']),
            'primary_color' => $data['primary_color'] ?? '#062436',
            'accent_color' => $data['accent_color'] ?? '#4f46e5',
            'logo_path' => $logoPath,
            'favicon_path' => $logoPath,
            'footer_text' => '© ' . date('Y') . ' ' . $data['company_name'] . '. All Rights Reserved.',
            'system_version' => config('version.version', '1.0.0'),
        ]);

        // Structural non-demo defaults only (no demo users, courses, branches, or reviews)
        DB::table('settings')->updateOrInsert(
            ['key' => 'homepage_slides'],
            ['value' => json_encode([], JSON_UNESCAPED_UNICODE)]
        );
        DB::table('settings')->updateOrInsert(
            ['key' => 'homepage_config'],
            ['value' => json_encode([
                'featured_badge' => 'Featured Programs',
                'featured_title' => 'Explore ' . $data['company_name'] . ' Courses',
                'featured_subtitle' => 'Structured courses, live cohorts, and guided practice.',
                'featured_cta' => 'Browse All Courses',
                'stats_mode' => 'auto',
                'stats_badge' => 'Platform Overview',
                'stats_title' => 'Live Academy Metrics',
                'stats_subtitle' => 'Real-time enrollment, course, faculty, and lesson totals.',
                'custom_students' => 0,
                'custom_courses' => 0,
                'custom_teachers' => 0,
                'custom_videos' => 0,
                'paths_heading' => 'Featured Courses',
                'paths_subheading' => 'Courses published by ' . $data['company_name'] . ' appear here automatically.',
            ], JSON_UNESCAPED_UNICODE)]
        );

        User::updateOrCreate(
            ['email' => $data['admin_email']],
            [
                'name' => $data['admin_name'],
                'role' => 'admin',
                'status' => 'active',
                'password' => Hash::make($data['admin_password']),
            ]
        );

        file_put_contents(
            storage_path('installed.lock'),
            json_encode([
                'company' => $data['company_name'],
                'version' => config('version.version', '1.0.0'),
                'installed_at' => now()->toIso8601String(),
            ], JSON_PRETTY_PRINT)
        );

        @unlink(storage_path('framework/install.key'));

        return redirect()->route('login', ['installed' => 1])->with('status', "{$data['company_name']} installed cleanly with zero demo data! Sign in with your Super Admin credentials.");
    }
}
