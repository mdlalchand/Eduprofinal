<?php

namespace Tests\Feature;

use App\Models\BackupSnapshot;
use App\Models\Branch;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\SystemUpdate;
use App\Models\User;
use App\Services\SystemUpdateService;
use App\Support\BrandSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;
use ZipArchive;

class NonDestructiveSystemUpdateTest extends TestCase
{
    use RefreshDatabase;

    private string $lockPath;
    private ?string $originalLock = null;
    private string $envPath;
    private ?string $originalEnv = null;
    private string $versionJsonPath;
    private ?string $originalVersionJson = null;
    private array $cleanupDirs = [];
    private array $cleanupFiles = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->lockPath = storage_path('installed.lock');
        $this->envPath = base_path('.env');
        $this->versionJsonPath = base_path('version.json');

        if (is_file($this->lockPath)) {
            $this->originalLock = file_get_contents($this->lockPath) ?: '';
        }
        if (is_file($this->envPath)) {
            $this->originalEnv = file_get_contents($this->envPath) ?: '';
        }
        if (is_file($this->versionJsonPath)) {
            $this->originalVersionJson = file_get_contents($this->versionJsonPath) ?: '';
        }
        file_put_contents($this->lockPath, json_encode(['installed' => true]));
        file_put_contents($this->envPath, "APP_NAME=\"Live Academy\"\nDB_CONNECTION=sqlite\n");
    }

    protected function tearDown(): void
    {
        foreach ($this->cleanupFiles as $file) {
            @unlink($file);
        }
        foreach ($this->cleanupDirs as $dir) {
            $this->removeDirectoryRecursive($dir);
        }
        @unlink(storage_path('framework/updating.flag'));

        if ($this->originalVersionJson !== null) {
            file_put_contents($this->versionJsonPath, $this->originalVersionJson);
        }

        if ($this->originalLock !== null) {
            file_put_contents($this->lockPath, $this->originalLock);
        } else {
            @unlink($this->lockPath);
        }

        if ($this->originalEnv !== null) {
            file_put_contents($this->envPath, $this->originalEnv);
        } else {
            @unlink($this->envPath);
        }

        parent::tearDown();
    }

    public function test_zip_update_preserves_all_records_env_lock_uploads_and_runs_incremental_migrations(): void
    {
        $admin = User::create([
            'name' => 'Site Admin',
            'email' => 'admin@domain.example',
            'role' => 'admin',
            'password' => Hash::make('AdminPass123!'),
        ]);
        $student = User::create([
            'name' => 'Priya Nair',
            'email' => 'priya@domain.example',
            'role' => 'student',
            'roll_number' => 'DOM-2026-1001',
            'password' => Hash::make('StudentPass123!'),
        ]);
        $branch = Branch::create(['name' => 'Main Hub', 'code' => 'MAIN', 'city' => 'Boston', 'address' => '10 Bay St', 'status' => 'active']);
        $course = Course::create([
            'slug' => 'data-analytics',
            'title' => 'Data Analytics Foundations',
            'subtitle' => 'SQL and Python',
            'category' => 'Data Science',
            'level_tag' => 'Beginner',
            'price' => 150,
            'original_price' => 200,
            'description' => 'Full analytics program.',
            'status' => 'active',
        ]);
        Enrollment::create([
            'user_id' => $student->id,
            'course_id' => $course->id,
            'branch_id' => $branch->id,
            'payment_method' => 'Bank Transfer',
            'amount_paid' => 150,
            'status' => 'approved',
            'completed_lesson_ids' => [1],
        ]);
        Certificate::create([
            'certificate_code' => 'DOM-CERT-2026-ABCDEF',
            'user_id' => $student->id,
            'course_id' => $course->id,
            'student_name' => $student->name,
            'course_title' => $course->title,
            'grade' => 'A+',
            'issued_by' => 'Live Academy',
            'issued_at' => now(),
            'revoked' => false,
        ]);

        BrandSettings::save(['company_name' => 'Live Academy', 'currency_symbol' => '$', 'roll_prefix' => 'DOM']);

        // Create an isolated target directory representing the domain hosting root during update
        $sandboxBase = storage_path('app/test-update-sandbox-' . bin2hex(random_bytes(3)));
        $this->cleanupDirs[] = $sandboxBase;
        mkdir($sandboxBase . '/storage', 0755, true);
        mkdir($sandboxBase . '/public/uploads/branding', 0755, true);
        mkdir($sandboxBase . '/database/migrations', 0755, true);
        mkdir($sandboxBase . '/resources/views', 0755, true);

        file_put_contents($sandboxBase . '/.env', "APP_NAME=\"Live Academy\"\nSECRET_TOKEN=keep_me_intact\n");
        file_put_contents($sandboxBase . '/storage/installed.lock', '{"locked":true}');
        file_put_contents($sandboxBase . '/public/uploads/branding/logo.txt', 'USER_UPLOADED_LOGO');
        file_put_contents($sandboxBase . '/database/live.sqlite', 'DO_NOT_OVERWRITE_SQLITE');
        file_put_contents($sandboxBase . '/resources/views/release-note.txt', 'old-v1.0.0');

        // Build a real .zip update archive containing code, a new incremental migration, AND attempts to overwrite protected paths
        $zipPath = storage_path('app/test-update-' . bin2hex(random_bytes(3)) . '.zip');
        $this->cleanupFiles[] = $zipPath;
        $zip = new ZipArchive();
        $this->assertTrue($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE));
        $zip->addFromString('version.json', json_encode(['version' => '1.1.0', 'notes' => 'Feature & schema release']));
        $zip->addFromString('resources/views/release-note.txt', 'upgraded-v1.1.0');
        $zip->addFromString('.env', 'MALICIOUS_OVERWRITE=true');
        $zip->addFromString('storage/installed.lock', 'CORRUPTED');
        $zip->addFromString('public/uploads/branding/logo.txt', 'WIPED_LOGO');
        $zip->addFromString('database/live.sqlite', 'WIPED_DB');
        $zip->addFromString(
            'database/migrations/2026_11_25_000099_create_custom_notices_table.php',
            <<<'PHP'
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('custom_notices')) {
            Schema::create('custom_notices', function (Blueprint $table) {
                $table->id();
                $table->string('headline');
                $table->timestamps();
            });
        }
    }
    public function down(): void
    {
        Schema::dropIfExists('custom_notices');
    }
};
PHP
        );
        $zip->close();

        $updater = app(SystemUpdateService::class);
        $record = $updater->applyUpdateZip($zipPath, 'academy-v1.1.0.zip', $admin->name, $sandboxBase);

        // 1. Update recorded cleanly and version bumped
        $this->assertSame('1.0.0', $record->from_version);
        $this->assertSame('1.1.0', $record->to_version);
        $this->assertSame('applied', $record->status);
        $this->assertSame('1.1.0', $updater->currentVersion());
        $this->assertFileDoesNotExist(storage_path('framework/updating.flag'));

        // 2. Application file updated, while protected files/uploads/.env/installed.lock were untouched
        $this->assertSame('upgraded-v1.1.0', file_get_contents($sandboxBase . '/resources/views/release-note.txt'));
        $this->assertStringContainsString('SECRET_TOKEN=keep_me_intact', (string) file_get_contents($sandboxBase . '/.env'));
        $this->assertSame('{"locked":true}', file_get_contents($sandboxBase . '/storage/installed.lock'));
        $this->assertSame('USER_UPLOADED_LOGO', file_get_contents($sandboxBase . '/public/uploads/branding/logo.txt'));
        $this->assertSame('DO_NOT_OVERWRITE_SQLITE', file_get_contents($sandboxBase . '/database/live.sqlite'));

        // 3. New migration ran incrementally without wiping ANY pre-existing records
        $this->assertTrue(Schema::hasTable('custom_notices'));
        $this->assertSame(2, User::count());
        $this->assertSame(1, Branch::count());
        $this->assertSame(1, Course::count());
        $this->assertSame(1, Enrollment::count());
        $this->assertSame(1, Certificate::count());
        $this->assertSame('Live Academy', BrandSettings::all()['company_name']);

        // 4. Pre-update backup snapshot exists with valid SHA-256
        $snapshot = BackupSnapshot::findOrFail($record->backup_snapshot_id);
        $this->assertSame($snapshot->checksum_sha256, hash('sha256', (string) $snapshot->payload_json));
    }

    public function test_failed_update_automatically_rolls_back_modified_files_and_logs_rollback(): void
    {
        $sandboxBase = storage_path('app/test-rollback-sandbox-' . bin2hex(random_bytes(3)));
        $this->cleanupDirs[] = $sandboxBase;
        mkdir($sandboxBase . '/resources/views', 0755, true);
        file_put_contents($sandboxBase . '/resources/views/panel.txt', 'original-stable-code');

        $zipPath = storage_path('app/test-broken-' . bin2hex(random_bytes(3)) . '.zip');
        $this->cleanupFiles[] = $zipPath;
        $zip = new ZipArchive();
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('version.json', json_encode(['version' => '1.2.0']));
        $zip->addFromString('resources/views/panel.txt', 'broken-half-applied-code');
        $zip->addFromString('resources/views/extra-file.txt', 'should-be-removed-on-rollback');
        $zip->close();

        $updater = app(SystemUpdateService::class);

        try {
            $updater->applyUpdateZip(
                $zipPath,
                'broken-v1.2.0.zip',
                'Site Admin',
                $sandboxBase,
                function () {
                    throw new RuntimeException('Simulated post-copy migration failure');
                }
            );
            $this->fail('Expected RuntimeException was not thrown.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Simulated post-copy migration failure', $e->getMessage());
        }

        // Verify original file restored, new file removed, and maintenance flag cleared
        $this->assertSame('original-stable-code', file_get_contents($sandboxBase . '/resources/views/panel.txt'));
        $this->assertFileDoesNotExist($sandboxBase . '/resources/views/extra-file.txt');
        $this->assertFileDoesNotExist(storage_path('framework/updating.flag'));

        $this->assertDatabaseHas('system_updates', [
            'package_name' => 'broken-v1.2.0.zip',
            'status' => 'rolled_back',
        ]);
    }

    public function test_http_backup_download_restore_and_portal_zip_upload_preserve_data(): void
    {
        $admin = User::create([
            'name' => 'Portal Admin',
            'email' => 'portal-admin@domain.example',
            'role' => 'admin',
            'password' => Hash::make('AdminPass123!'),
        ]);
        $branch = Branch::create(['name' => 'Central Hub', 'code' => 'CNT', 'city' => 'Chicago', 'address' => '1 State St', 'status' => 'active']);

        // 1. Create verified backup via HTTP
        $this->actingAs($admin)->post(route('portal.updates.backup'), [
            'label' => 'Before Major Upgrade',
        ])->assertRedirect();

        $snapshot = BackupSnapshot::latest('id')->firstOrFail();

        // 2. Download verified backup JSON
        $dl = $this->actingAs($admin)->get(route('portal.updates.backup.download', $snapshot));
        $dl->assertOk();
        $dl->assertHeader('Content-Type', 'application/json');

        // 3. Mutate data then restore backup snapshot and verify data recovery
        $branch->delete();
        $this->assertSame(0, Branch::count());

        $this->actingAs($admin)->post(route('portal.updates.backup.restore', $snapshot))->assertRedirect();
        $this->assertSame(1, Branch::count());
        $this->assertSame('Central Hub', Branch::firstOrFail()->name);

        // 4. Upload non-destructive ZIP update via HTTP route using an isolated update payload
        $tempNotePath = base_path('storage/test_release_ignore_check.txt');
        $docNotePath = base_path('RELEASE_UPDATE_NOTE.txt');
        $this->cleanupFiles[] = $docNotePath;

        $zipPath = sys_get_temp_dir() . '/portal-patch-' . bin2hex(random_bytes(3)) . '.zip';
        $this->cleanupFiles[] = $zipPath;
        $zip = new ZipArchive();
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('version.json', json_encode(['version' => '1.0.1', 'notes' => 'HTTP ZIP patch']));
        $zip->addFromString('RELEASE_UPDATE_NOTE.txt', 'Patched safely via Portal HTTP upload');
        $zip->addFromString('.env', 'HACKED=1');
        $zip->close();

        $upload = new UploadedFile($zipPath, 'academy-patch-1.0.1.zip', 'application/zip', null, true);

        $this->actingAs($admin)->post(route('portal.updates.apply'), [
            'update_package' => $upload,
        ])->assertRedirect();

        $this->assertFileExists($docNotePath);
        $this->assertStringNotContainsString('HACKED=1', (string) file_get_contents($this->envPath));
        $this->assertSame('Central Hub', Branch::firstOrFail()->name);
        $this->assertDatabaseHas('system_updates', [
            'to_version' => '1.0.1',
            'status' => 'applied',
        ]);
    }

    private function removeDirectoryRecursive(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($items as $item) {
            $item->isDir() ? @rmdir($item->getRealPath()) : @unlink($item->getRealPath());
        }
        @rmdir($dir);
    }
}
