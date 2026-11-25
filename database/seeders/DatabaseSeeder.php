<?php

namespace Database\Seeders;

use App\Support\BrandSettings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    /**
     * Zero-demo-data initialization: ensures only structural settings exist
     * without inserting fake students, teachers, courses, branches, or reviews.
     */
    public function run(): void
    {
        $brand = BrandSettings::all();

        if (!DB::table('settings')->where('key', 'homepage_slides')->exists()) {
            DB::table('settings')->insert([
                'key' => 'homepage_slides',
                'value' => json_encode([], JSON_UNESCAPED_UNICODE),
            ]);
        }

        if (!DB::table('settings')->where('key', 'homepage_config')->exists()) {
            DB::table('settings')->insert([
                'key' => 'homepage_config',
                'value' => json_encode([
                    'featured_badge' => 'Featured Programs',
                    'featured_title' => 'Explore Our Learning Programs',
                    'featured_subtitle' => 'Structured courses, live cohorts, and guided practice.',
                    'featured_cta' => 'Browse All Courses',
                    'stats_mode' => 'auto',
                    'stats_badge' => 'Platform Overview',
                    'stats_title' => 'Live Academy Metrics',
                    'stats_subtitle' => 'Real-time enrollment, course, faculty, and lesson totals.',
                    'custom_students' => 0,
                    'custom_courses' => 0,
                    'custom_teachers' => 0,
                    'custom_videos' => 0,
                    'paths_heading' => 'Featured Courses',
                    'paths_subheading' => 'Courses published by ' . $brand['company_name'] . ' appear here automatically.',
                ], JSON_UNESCAPED_UNICODE),
            ]);
        }
    }
}
