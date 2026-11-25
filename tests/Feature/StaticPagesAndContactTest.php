<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\ContactInquiry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StaticPagesAndContactTest extends TestCase
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

    public function test_about_contact_and_policy_pages_render(): void
    {
        DB::table('settings')->insert([
            'key' => 'about_mission',
            'value' => 'We help learners reach their goals.',
        ]);
        DB::table('settings')->insert([
            'key' => 'privacy_content',
            'value' => 'We protect learner data.',
        ]);

        $this->get('/about-us')->assertOk()->assertSee('About')->assertSee('We help learners reach their goals.');
        $this->get('/about')->assertOk();
        $this->get('/contact')->assertOk()->assertSee('Send an Inquiry');
        $this->get('/contact-us')->assertOk();
        $this->get('/privacy-policy')->assertOk()->assertSee('We protect learner data.');
        $this->get('/terms-and-conditions')->assertOk();
        $this->get('/refund-policy')->assertOk();
    }

    public function test_contact_inquiry_is_validated_and_saved_for_admin_review(): void
    {
        $branch = Branch::create([
            'name' => 'Dhanmondi Campus',
            'code' => 'DHN',
            'city' => 'Dhaka',
            'address' => 'Road 4',
            'status' => 'active',
        ]);

        $this->post('/contact', [
            'name' => 'Nusrat Jahan',
            'email' => 'nusrat@example.test',
            'phone' => '01712345678',
            'branch_id' => $branch->id,
            'message' => 'I want details about the IELTS batch.',
        ])->assertRedirect(route('contact'))->assertSessionHas('status');

        $this->assertDatabaseHas('contact_inquiries', [
            'name' => 'Nusrat Jahan',
            'email' => 'nusrat@example.test',
            'branch_id' => $branch->id,
            'status' => 'pending',
        ]);
        $this->assertSame(1, ContactInquiry::count());
    }

    public function test_published_custom_pages_render_and_unpublished_pages_are_hidden(): void
    {
        DB::table('settings')->insert([
            'key' => 'custom_pages',
            'value' => json_encode([
                ['title' => 'Frequently Asked Questions', 'slug' => 'faq', 'subtitle' => 'Answers', 'body' => 'Ask our support team.', 'published' => true],
                ['title' => 'Internal Draft', 'slug' => 'internal-draft', 'body' => 'Not public.', 'published' => false],
            ]),
        ]);

        $this->get('/page/faq')->assertOk()->assertSee('Frequently Asked Questions')->assertSee('Ask our support team.');
        $this->get('/page/internal-draft')->assertNotFound();
        $this->get('/page/missing')->assertNotFound();
    }

    public function test_admin_can_review_contact_inquiry_and_manage_custom_pages(): void
    {
        $admin = User::create([
            'name' => 'CMS Admin',
            'email' => 'cms.admin@example.test',
            'role' => 'admin',
            'status' => 'active',
            'password' => Hash::make('AdminPass123!'),
        ]);
        $inquiry = ContactInquiry::create([
            'name' => 'Visitor',
            'phone' => '01700000000',
            'message' => 'Please contact me about admission.',
        ]);

        $this->actingAs($admin)->get(route('portal.index'))->assertOk()->assertSee('Public Content &amp; CMS Pages');
        $this->actingAs($admin)->patch(route('portal.contact_inquiries.status', $inquiry), ['status' => 'contacted'])
            ->assertRedirect();
        $this->assertSame('contacted', $inquiry->fresh()->status);

        $this->actingAs($admin)->post(route('portal.content_pages.store'), [
            'title' => 'Admission FAQ',
            'slug' => 'admission-faq',
            'subtitle' => 'Admissions',
            'body' => 'Contact our branch team.',
            'published' => 1,
        ])->assertRedirect();

        $this->get('/page/admission-faq')->assertOk()->assertSee('Admission FAQ');
        $this->actingAs($admin)->delete(route('portal.content_pages.delete', 'admission-faq'))->assertRedirect();
        $this->get('/page/admission-faq')->assertNotFound();
    }
}
