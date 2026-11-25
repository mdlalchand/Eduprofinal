<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileManagementTest extends TestCase
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

    public function test_user_can_update_profile_but_not_change_privileged_account_fields(): void
    {
        $user = User::create([
            'name' => 'Original Student',
            'email' => 'original@student.example',
            'phone' => '01700000000',
            'role' => 'student',
            'status' => 'active',
            'password' => Hash::make('StudentPass123!'),
        ]);

        $this->actingAs($user)->get(route('profile'))->assertOk()->assertSee('My Profile');
        $this->actingAs($user)->put(route('profile.update'), [
            'name' => 'Updated Student',
            'email' => 'updated@student.example',
            'phone' => '01711112222',
            'education' => 'HSC',
            'subject_specialty' => 'English',
            'bio' => 'Learning every day.',
            'role' => 'admin',
            'status' => 'active',
        ])->assertRedirect()->assertSessionHas('status');

        $this->assertSame('Updated Student', $user->fresh()->name);
        $this->assertSame('original@student.example', $user->fresh()->email);
        $this->assertSame('student', $user->fresh()->role);
        $this->assertSame('active', $user->fresh()->status);
    }

    public function test_user_must_provide_current_password_to_change_password(): void
    {
        $user = User::create([
            'name' => 'Password Student',
            'email' => 'password@student.example',
            'role' => 'student',
            'status' => 'active',
            'password' => Hash::make('StudentPass123!'),
        ]);

        $this->actingAs($user)->put(route('profile.password.update'), [
            'current_password' => 'wrong-current-password',
            'password' => 'NewStudentPass123!',
            'password_confirmation' => 'NewStudentPass123!',
        ])->assertSessionHasErrors('current_password');

        $this->assertTrue(Hash::check('StudentPass123!', $user->fresh()->password));

        $this->actingAs($user)->put(route('profile.password.update'), [
            'current_password' => 'StudentPass123!',
            'password' => 'NewStudentPass123!',
            'password_confirmation' => 'NewStudentPass123!',
        ])->assertRedirect()->assertSessionHas('status');

        $this->assertTrue(Hash::check('NewStudentPass123!', $user->fresh()->password));
    }
}
