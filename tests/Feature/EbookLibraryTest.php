<?php

namespace Tests\Feature;

use App\Models\Ebook;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class EbookLibraryTest extends TestCase
{
    use RefreshDatabase;

    private string $lockPath;
    private ?string $originalLock = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->lockPath = storage_path('installed.lock');
        if (is_file($this->lockPath)) {
            $this->originalLock = file_get_contents($this->lockPath) ?: '';
        }
        file_put_contents($this->lockPath, json_encode(['installed' => true]));
    }

    protected function tearDown(): void
    {
        if ($this->originalLock !== null) {
            file_put_contents($this->lockPath, $this->originalLock);
        } else {
            @unlink($this->lockPath);
        }
        parent::tearDown();
    }

    private function student(): User
    {
        return User::create([
            'name' => 'Library Student',
            'email' => 'library.student@example.test',
            'role' => 'student',
            'status' => 'active',
            'password' => Hash::make('StudentPass123!'),
        ]);
    }

    public function test_free_ebook_claim_is_persisted_to_the_student_library(): void
    {
        $student = $this->student();
        $ebook = Ebook::create([
            'title' => 'Free Study Guide',
            'level' => 'Beginner',
            'is_free' => true,
            'price' => 0,
            'original_price' => 0,
            'author' => 'Academy',
            'pages_count' => 12,
            'summary' => 'A free guide.',
        ]);

        $this->actingAs($student)
            ->post(route('ebooks.claim', $ebook))
            ->assertRedirect()
            ->assertSessionHas('status');

        $this->assertDatabaseHas('ebook_user', [
            'user_id' => $student->id,
            'ebook_id' => $ebook->id,
        ]);
        $this->assertCount(1, $student->ebooks);
    }

    public function test_paid_ebook_cannot_be_unlocked_with_an_unverified_transaction_id(): void
    {
        $student = $this->student();
        $ebook = Ebook::create([
            'title' => 'Paid Exam Guide',
            'level' => 'Advanced',
            'is_free' => false,
            'price' => 500,
            'original_price' => 700,
            'author' => 'Academy',
            'pages_count' => 40,
            'summary' => 'A paid guide.',
        ]);

        $this->actingAs($student)
            ->post(route('ebooks.claim', $ebook), ['trx_id' => 'FAKE-TRANSACTION-123'])
            ->assertRedirect()
            ->assertSessionHasErrors('ebook');

        $this->assertDatabaseMissing('ebook_user', [
            'user_id' => $student->id,
            'ebook_id' => $ebook->id,
        ]);
    }

    public function test_non_student_accounts_cannot_claim_ebooks(): void
    {
        $admin = User::create([
            'name' => 'Library Admin',
            'email' => 'library.admin@example.test',
            'role' => 'admin',
            'status' => 'active',
            'password' => Hash::make('AdminPass123!'),
        ]);
        $ebook = Ebook::create([
            'title' => 'Free Study Guide',
            'level' => 'Beginner',
            'is_free' => true,
            'price' => 0,
            'original_price' => 0,
            'author' => 'Academy',
            'pages_count' => 12,
            'summary' => 'A free guide.',
        ]);

        $this->actingAs($admin)
            ->post(route('ebooks.claim', $ebook))
            ->assertForbidden();

        $this->assertDatabaseMissing('ebook_user', [
            'user_id' => $admin->id,
            'ebook_id' => $ebook->id,
        ]);
    }
}
