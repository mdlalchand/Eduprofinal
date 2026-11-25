<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('city');
            $table->string('address');
            $table->string('phone')->default('');
            $table->string('manager_name')->nullable();
            $table->unsignedInteger('active_students')->default(0);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->enum('role', ['admin', 'branch', 'teacher', 'student', 'guardian'])->default('student');
            $table->enum('status', ['pending', 'active', 'suspended', 'rejected'])->default('active');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('roll_number')->nullable()->unique();
            $table->string('education')->nullable();
            $table->string('subject_specialty')->nullable();
            $table->text('bio')->nullable();
            $table->text('approval_note')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('approved_by')->nullable();
            $table->string('password_reset_token_hash')->nullable();
            $table->timestamp('password_reset_expires_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('guardian_student', function (Blueprint $table) {
            $table->id();
            $table->foreignId('guardian_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->unique(['guardian_id', 'student_id']);
        });

        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('subtitle');
            $table->string('category');
            $table->string('level_tag');
            $table->boolean('is_combo')->default(false);
            $table->json('included_courses')->nullable();
            $table->unsignedInteger('price');
            $table->unsignedInteger('original_price');
            $table->unsignedInteger('enrolled_count')->default(0);
            $table->boolean('exam_system_included')->default(true);
            $table->string('thumbnail')->nullable();
            $table->text('description');
            $table->string('demo_video_title')->nullable();
            $table->enum('status', ['active', 'draft'])->default('active');
            $table->timestamps();
        });

        Schema::create('batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->string('name');
            $table->string('code')->unique();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('instructor_name')->nullable();
            $table->string('schedule');
            $table->string('start_date')->nullable();
            $table->unsignedInteger('seat_limit')->default(60);
            $table->unsignedInteger('enrolled_seats')->default(0);
            $table->enum('mode', ['Online Live', 'Offline Branch', 'Hybrid'])->default('Hybrid');
            $table->enum('status', ['open', 'running', 'closed'])->default('open');
            $table->timestamps();
        });

        Schema::create('lessons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('batch_id')->nullable()->constrained('batches')->nullOnDelete();
            $table->enum('lesson_type', ['recorded', 'live', 'lecture_sheet'])->default('recorded');
            $table->string('title');
            $table->string('module_name');
            $table->string('duration')->default('35:00');
            $table->string('video_url')->nullable();
            $table->string('lecture_sheet_url')->nullable();
            $table->string('live_join_url')->nullable();
            $table->enum('live_status', ['scheduled', 'live_now', 'ended'])->nullable();
            $table->string('scheduled_at')->nullable();
            $table->text('sheet_summary')->nullable();
            $table->boolean('is_free_preview')->default(false);
            $table->unsignedInteger('order_index')->default(1);
            $table->timestamps();
        });

        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('payment_method');
            $table->unsignedInteger('amount_paid');
            $table->string('coupon_used')->nullable();
            $table->enum('status', ['approved', 'pending', 'rejected'])->default('pending');
            $table->json('completed_lesson_ids')->nullable();
            $table->timestamps();
        });

        Schema::create('exams', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->foreignId('course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->string('category');
            $table->unsignedInteger('duration_minutes')->default(15);
            $table->unsignedInteger('pass_percentage')->default(50);
            $table->enum('visibility', ['public', 'course'])->default('public');
            $table->foreignId('teacher_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('exam_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained('exams')->cascadeOnDelete();
            $table->text('prompt');
            $table->json('options');
            $table->unsignedTinyInteger('correct_index');
            $table->text('explanation')->nullable();
            $table->unsignedInteger('marks')->default(2);
            $table->timestamps();
        });

        Schema::create('exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained('exams')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('score');
            $table->unsignedInteger('total_marks');
            $table->unsignedInteger('percentage');
            $table->string('grade');
            $table->boolean('passed');
            $table->json('answers');
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('category');
            $table->unsignedInteger('price');
            $table->unsignedInteger('original_price');
            $table->unsignedInteger('stock')->default(0);
            $table->string('image')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('phone');
            $table->string('delivery_address');
            $table->foreignId('branch_pickup_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->json('items');
            $table->unsignedInteger('delivery_fee')->default(0);
            $table->unsignedInteger('total_amount');
            $table->enum('status', ['processing', 'shipped', 'delivered', 'cancelled'])->default('processing');
            $table->timestamps();
        });

        Schema::create('ebooks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('level');
            $table->boolean('is_free')->default(true);
            $table->unsignedInteger('price')->default(0);
            $table->unsignedInteger('original_price')->default(0);
            $table->string('author');
            $table->unsignedInteger('pages_count')->default(40);
            $table->text('summary');
            $table->timestamps();
        });

        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->unsignedInteger('discount_percent');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('center_results', function (Blueprint $table) {
            $table->id();
            $table->string('roll_number')->index();
            $table->string('student_name');
            $table->string('batch_name');
            $table->string('branch_name');
            $table->string('exam_name');
            $table->unsignedInteger('mcq_score');
            $table->unsignedInteger('written_score');
            $table->unsignedInteger('total_score');
            $table->string('grade');
            $table->unsignedInteger('merit_position');
            $table->timestamps();
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('role_label')->default('Verified Student');
            $table->text('text');
            $table->unsignedTinyInteger('rating')->default(5);
            $table->unsignedTinyInteger('row')->default(1);
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->longText('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('reviews');
        Schema::dropIfExists('center_results');
        Schema::dropIfExists('coupons');
        Schema::dropIfExists('ebooks');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('products');
        Schema::dropIfExists('exam_attempts');
        Schema::dropIfExists('exam_questions');
        Schema::dropIfExists('exams');
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('lessons');
        Schema::dropIfExists('batches');
        Schema::dropIfExists('courses');
        Schema::dropIfExists('guardian_student');
        Schema::dropIfExists('users');
        Schema::dropIfExists('branches');
    }
};
