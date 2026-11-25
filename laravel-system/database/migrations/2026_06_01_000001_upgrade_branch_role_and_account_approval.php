<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'status')) {
                $table->string('status', 24)->default('active')->after('role');
            }
            if (!Schema::hasColumn('users', 'education')) {
                $table->string('education')->nullable()->after('roll_number');
            }
            if (!Schema::hasColumn('users', 'subject_specialty')) {
                $table->string('subject_specialty')->nullable()->after('education');
            }
            if (!Schema::hasColumn('users', 'bio')) {
                $table->text('bio')->nullable()->after('subject_specialty');
            }
            if (!Schema::hasColumn('users', 'approval_note')) {
                $table->text('approval_note')->nullable()->after('bio');
            }
            if (!Schema::hasColumn('users', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approval_note');
            }
            if (!Schema::hasColumn('users', 'approved_by')) {
                $table->string('approved_by')->nullable()->after('approved_at');
            }
            if (!Schema::hasColumn('users', 'password_reset_token_hash')) {
                $table->string('password_reset_token_hash')->nullable()->after('approved_by');
            }
            if (!Schema::hasColumn('users', 'password_reset_expires_at')) {
                $table->timestamp('password_reset_expires_at')->nullable()->after('password_reset_token_hash');
            }
        });

        $driver = DB::getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role VARCHAR(32) NOT NULL DEFAULT 'student'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
            DB::statement("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(32)");
        }

        if ($driver !== 'sqlite') {
            DB::table('users')->where('role', 'branch_manager')->update(['role' => 'branch']);
        }
    }

    public function down(): void
    {
        // Non-destructive upgrade migration: keep user data intact on rollback
    }
};
