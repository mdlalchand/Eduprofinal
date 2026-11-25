<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contact_inquiries', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('email', 140)->nullable();
            $table->string('phone', 40);
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->text('message');
            $table->enum('status', ['pending', 'contacted'])->default('pending');
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_inquiries');
    }
};
