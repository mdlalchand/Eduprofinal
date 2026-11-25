<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->enum('status', ['approved', 'pending', 'hidden'])->default('approved')->after('row');
            $table->boolean('featured')->default(false)->after('status');
            $table->string('course_tag')->nullable()->after('featured');
            $table->string('avatar')->nullable()->after('course_tag');
        });

        Schema::table('coupons', function (Blueprint $table) {
            $table->enum('applies_to', ['all', 'courses', 'products'])->default('all')->after('active');
            $table->string('description')->nullable()->after('applies_to');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->string('trx_id')->nullable()->after('payment_method');
            $table->string('invoice_no')->nullable()->after('trx_id');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('discount_amount')->default(0)->after('delivery_fee');
            $table->string('coupon_used')->nullable()->after('discount_amount');
            $table->string('payment_method')->default('bKash')->after('coupon_used');
            $table->string('trx_id')->nullable()->after('payment_method');
            $table->string('invoice_no')->nullable()->after('trx_id');
        });

        Schema::create('question_bank_items', function (Blueprint $table) {
            $table->id();
            $table->string('subject');
            $table->string('chapter')->default('General');
            $table->enum('difficulty', ['Easy', 'Medium', 'Hard'])->default('Medium');
            $table->text('prompt');
            $table->json('options');
            $table->unsignedTinyInteger('correct_index')->default(0);
            $table->text('explanation')->nullable();
            $table->unsignedInteger('marks')->default(1);
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->enum('type', ['course', 'product', 'ebook', 'post'])->default('course');
            $table->string('image')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('community_posts', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('category')->default('Exam Strategy & Tips');
            $table->longText('content');
            $table->string('image')->nullable();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('likes')->default(0);
            $table->enum('status', ['published', 'draft'])->default('published');
            $table->timestamps();
        });

        Schema::create('scorm_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->string('title');
            $table->string('identifier');
            $table->string('launch_file')->default('index.html');
            $table->longText('manifest_xml');
            $table->text('html_content');
            $table->unsignedInteger('xp_reward')->default(150);
            $table->timestamps();
        });

        Schema::create('learner_rewards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('xp')->default(0);
            $table->unsignedInteger('streak_days')->default(1);
            $table->json('badges')->nullable();
            $table->boolean('show_on_leaderboard')->default(true);
            $table->timestamps();
        });

        Schema::create('attendance_records', function (Blueprint $table) {
            $table->id();
            $table->enum('target_type', ['student', 'teacher', 'staff'])->default('student');
            $table->foreignId('target_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->date('attendance_date');
            $table->enum('status', ['present', 'absent', 'late', 'leave'])->default('present');
            $table->string('check_in_time')->nullable();
            $table->string('recorded_by');
            $table->timestamps();
            $table->unique(['target_id', 'attendance_date']);
        });

        Schema::create('payroll_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->string('month_key');
            $table->unsignedInteger('base_salary');
            $table->unsignedInteger('allowances')->default(0);
            $table->unsignedInteger('bonuses')->default(0);
            $table->unsignedInteger('deductions')->default(0);
            $table->unsignedInteger('advance')->default(0);
            $table->unsignedInteger('net_salary');
            $table->enum('status', ['pending', 'approved', 'paid'])->default('pending');
            $table->timestamps();
            $table->unique(['employee_id', 'month_key']);
        });

        Schema::create('financial_records', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['income', 'expense', 'refund'])->default('income');
            $table->string('category');
            $table->string('title');
            $table->unsignedInteger('amount');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->date('entry_date');
            $table->string('recorded_by');
            $table->timestamps();
        });

        Schema::create('recycle_bin_items', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type');
            $table->string('original_id');
            $table->string('label');
            $table->string('deleted_by');
            $table->longText('snapshot_json');
            $table->timestamps();
        });

        Schema::create('backup_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->enum('reason', ['manual', 'pre_reset', 'pre_restore'])->default('manual');
            $table->string('checksum_sha256', 64);
            $table->boolean('verified')->default(true);
            $table->string('created_by');
            $table->longText('payload_json');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_snapshots');
        Schema::dropIfExists('recycle_bin_items');
        Schema::dropIfExists('financial_records');
        Schema::dropIfExists('payroll_records');
        Schema::dropIfExists('attendance_records');
        Schema::dropIfExists('learner_rewards');
        Schema::dropIfExists('scorm_packages');
        Schema::dropIfExists('community_posts');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('question_bank_items');
    }
};
