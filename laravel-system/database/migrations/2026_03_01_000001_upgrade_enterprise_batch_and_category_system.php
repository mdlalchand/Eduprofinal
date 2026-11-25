<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('batches', function (Blueprint $table) {
            if (!Schema::hasColumn('batches', 'description')) {
                $table->text('description')->nullable()->after('code');
            }
            if (!Schema::hasColumn('batches', 'thumbnail')) {
                $table->string('thumbnail')->nullable()->after('description');
            }
            if (!Schema::hasColumn('batches', 'main_teacher_id')) {
                $table->foreignId('main_teacher_id')->nullable()->after('branch_id')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('batches', 'assistant_teacher_id')) {
                $table->foreignId('assistant_teacher_id')->nullable()->after('main_teacher_id')->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('batches', 'batch_type')) {
                $table->enum('batch_type', ['Offline', 'Online', 'Hybrid'])->default('Hybrid')->after('mode');
            }
            if (!Schema::hasColumn('batches', 'lifecycle_status')) {
                $table->enum('lifecycle_status', [
                    'draft',
                    'upcoming',
                    'enrollment_open',
                    'enrollment_closed',
                    'active',
                    'completed',
                    'cancelled',
                    'archived',
                ])->default('enrollment_open')->after('status');
            }
            if (!Schema::hasColumn('batches', 'end_date')) {
                $table->string('end_date')->nullable()->after('start_date');
            }
            if (!Schema::hasColumn('batches', 'enrollment_start_date')) {
                $table->string('enrollment_start_date')->nullable()->after('end_date');
            }
            if (!Schema::hasColumn('batches', 'enrollment_closing_date')) {
                $table->string('enrollment_closing_date')->nullable()->after('enrollment_start_date');
            }
            if (!Schema::hasColumn('batches', 'enrollment_deadline')) {
                $table->string('enrollment_deadline')->nullable()->after('enrollment_closing_date');
            }
            if (!Schema::hasColumn('batches', 'min_students')) {
                $table->unsignedInteger('min_students')->default(5)->after('seat_limit');
            }
            if (!Schema::hasColumn('batches', 'waitlist_enabled')) {
                $table->boolean('waitlist_enabled')->default(true)->after('enrolled_seats');
            }
            if (!Schema::hasColumn('batches', 'class_duration_minutes')) {
                $table->unsignedInteger('class_duration_minutes')->default(90)->after('schedule');
            }
            if (!Schema::hasColumn('batches', 'break_minutes')) {
                $table->unsignedInteger('break_minutes')->default(10)->after('class_duration_minutes');
            }
            if (!Schema::hasColumn('batches', 'weekly_frequency')) {
                $table->unsignedTinyInteger('weekly_frequency')->default(3)->after('break_minutes');
            }
            if (!Schema::hasColumn('batches', 'total_classes')) {
                $table->unsignedInteger('total_classes')->default(36)->after('weekly_frequency');
            }
            if (!Schema::hasColumn('batches', 'online_settings')) {
                $table->json('online_settings')->nullable()->after('waitlist_enabled');
            }
            if (!Schema::hasColumn('batches', 'fee_settings')) {
                $table->json('fee_settings')->nullable()->after('online_settings');
            }
            if (!Schema::hasColumn('batches', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('lifecycle_status');
            }
        });

        if (Schema::hasTable('enrollments') && !Schema::hasColumn('enrollments', 'batch_id')) {
            Schema::table('enrollments', function (Blueprint $table) {
                $table->foreignId('batch_id')->nullable()->after('branch_id')->constrained('batches')->nullOnDelete();
            });
        }

        if (Schema::hasTable('attendance_records') && !Schema::hasColumn('attendance_records', 'batch_id')) {
            Schema::table('attendance_records', function (Blueprint $table) {
                $table->foreignId('batch_id')->nullable()->after('branch_id')->constrained('batches')->nullOnDelete();
            });
        }

        if (Schema::hasTable('exams') && !Schema::hasColumn('exams', 'batch_id')) {
            Schema::table('exams', function (Blueprint $table) {
                $table->foreignId('batch_id')->nullable()->after('course_id')->constrained('batches')->nullOnDelete();
            });
        }

        if (!Schema::hasTable('batch_teachers')) {
            Schema::create('batch_teachers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('batch_id')->constrained('batches')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->enum('role', ['main', 'assistant', 'co_teacher'])->default('main');
                $table->string('responsibility')->nullable();
                $table->string('assigned_by')->nullable();
                $table->timestamps();
                $table->unique(['batch_id', 'user_id']);
            });
        }

        if (!Schema::hasTable('batch_schedules')) {
            Schema::create('batch_schedules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('batch_id')->constrained('batches')->cascadeOnDelete();
                $table->string('title')->default('Regular Lecture');
                $table->enum('day_of_week', ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
                $table->string('start_time', 10);
                $table->string('end_time', 10);
                $table->unsignedInteger('duration_minutes')->default(90);
                $table->unsignedInteger('break_minutes')->default(0);
                $table->foreignId('teacher_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('room_label')->nullable();
                $table->date('session_date')->nullable();
                $table->enum('status', ['scheduled', 'completed', 'cancelled', 'rescheduled'])->default('scheduled');
                $table->string('cancel_reason')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('batch_classrooms')) {
            Schema::create('batch_classrooms', function (Blueprint $table) {
                $table->id();
                $table->foreignId('batch_id')->unique()->constrained('batches')->cascadeOnDelete();
                $table->string('classroom_name')->nullable();
                $table->string('building')->nullable();
                $table->string('floor')->nullable();
                $table->string('room_number')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('batch_waitlists')) {
            Schema::create('batch_waitlists', function (Blueprint $table) {
                $table->id();
                $table->foreignId('batch_id')->constrained('batches')->cascadeOnDelete();
                $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedInteger('priority')->default(1);
                $table->enum('status', ['waiting', 'promoted', 'cancelled'])->default('waiting');
                $table->string('note')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('batch_transfers')) {
            Schema::create('batch_transfers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('enrollment_id')->constrained('enrollments')->cascadeOnDelete();
                $table->foreignId('student_user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('from_batch_id')->nullable()->constrained('batches')->nullOnDelete();
                $table->foreignId('to_batch_id')->constrained('batches')->cascadeOnDelete();
                $table->foreignId('from_course_id')->constrained('courses')->cascadeOnDelete();
                $table->foreignId('to_course_id')->constrained('courses')->cascadeOnDelete();
                $table->string('reason')->nullable();
                $table->unsignedInteger('preserved_attendance_count')->default(0);
                $table->unsignedInteger('preserved_payment_count')->default(0);
                $table->string('actor_name');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('batch_announcements')) {
            Schema::create('batch_announcements', function (Blueprint $table) {
                $table->id();
                $table->foreignId('batch_id')->constrained('batches')->cascadeOnDelete();
                $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
                $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('title');
                $table->text('message');
                $table->boolean('pinned')->default(false);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('batch_notifications')) {
            Schema::create('batch_notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('batch_id')->constrained('batches')->cascadeOnDelete();
                $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
                $table->string('type', 40);
                $table->string('title');
                $table->text('message');
                $table->string('channel', 30)->default('in_app');
                $table->string('created_by');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('batch_activity_logs')) {
            Schema::create('batch_activity_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('batch_id')->constrained('batches')->cascadeOnDelete();
                $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('actor_name');
                $table->string('actor_role', 40);
                $table->string('action', 80);
                $table->text('details');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_activity_logs');
        Schema::dropIfExists('batch_notifications');
        Schema::dropIfExists('batch_announcements');
        Schema::dropIfExists('batch_transfers');
        Schema::dropIfExists('batch_waitlists');
        Schema::dropIfExists('batch_classrooms');
        Schema::dropIfExists('batch_schedules');
        Schema::dropIfExists('batch_teachers');
    }
};
