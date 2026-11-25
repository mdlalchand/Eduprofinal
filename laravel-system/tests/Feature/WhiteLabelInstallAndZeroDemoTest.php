<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\CenterResult;
use App\Models\Certificate;
use App\Models\CommunityPost;
use App\Models\Coupon;
use App\Models\Course;
use App\Models\Ebook;
use App\Models\Exam;
use App\Models\Lesson;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use App\Support\BrandSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class WhiteLabelInstallAndZeroDemoTest extends TestCase
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

    public function test_fresh_database_has_zero_demo_data_and_renders_custom_company_branding(): void
    {
        BrandSettings::save([
            'company_name' => 'Horizon Global Academy',
            'tagline' => 'Executive & Technical Training',
            'support_email' => 'admissions@horizonglobal.example',
            'currency_symbol' => '£',
            'roll_prefix' => 'HGA',
            'primary_color' => '#1e293b',
            'accent_color' => '#059669',
        ]);

        DB::table('settings')->updateOrInsert(
            ['key' => 'homepage_config'],
            ['value' => json_encode(['stats_mode' => 'auto'])]
        );

        $this->assertSame(0, User::count());
        $this->assertSame(0, Branch::count());
        $this->assertSame(0, Course::count());
        $this->assertSame(0, Lesson::count());
        $this->assertSame(0, Exam::count());
        $this->assertSame(0, Product::count());
        $this->assertSame(0, Ebook::count());
        $this->assertSame(0, Coupon::count());
        $this->assertSame(0, CenterResult::count());
        $this->assertSame(0, Review::count());
        $this->assertSame(0, CommunityPost::count());
        $this->assertSame(0, Certificate::count());

        $home = $this->get('/');
        $home->assertOk();
        $home->assertSee('Horizon Global Academy');
        $home->assertDontSee('Aloms');
        $home->assertDontSee('AI Studio');

        $this->get('/courses')->assertOk()->assertSee('Horizon Global Academy');
        $this->get('/login')->assertOk()->assertSee('Horizon Global Academy');
    }
}
