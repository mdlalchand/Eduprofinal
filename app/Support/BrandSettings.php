<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class BrandSettings
{
    public static function defaults(): array
    {
        $appName = (string) config('app.name', 'Academy LMS');
        if (trim($appName) === '' || stripos($appName, 'laravel') !== false) {
            $appName = 'Academy LMS';
        }

        return [
            'company_name' => $appName,
            'tagline' => 'Online & Campus Learning Management Platform',
            'support_email' => 'support@example.com',
            'support_phone' => '',
            'office_address' => '',
            'currency_symbol' => '$',
            'primary_color' => '#062436',
            'accent_color' => '#4f46e5',
            'roll_prefix' => 'STD',
            'logo_path' => 'images/default-logo.svg',
            'favicon_path' => 'images/default-logo.svg',
            'footer_text' => '',
            'system_version' => config('version.version', '1.0.0'),
        ];
    }

    public static function all(): array
    {
        $defaults = self::defaults();

        try {
            if (!Schema::hasTable('settings')) {
                $defaults['logo_url'] = asset($defaults['logo_path']);
                $defaults['favicon_url'] = asset($defaults['favicon_path']);
                return $defaults;
            }

            $rows = DB::table('settings')
                ->whereIn('key', array_merge(array_keys($defaults), ['email', 'phone', 'address', 'brand_profile']))
                ->pluck('value', 'key')
                ->all();

            $profile = [];
            if (!empty($rows['brand_profile'])) {
                $decoded = json_decode((string) $rows['brand_profile'], true);
                if (is_array($decoded)) {
                    $profile = $decoded;
                }
            }

            $merged = array_merge($defaults, $profile);
            foreach (array_keys($defaults) as $key) {
                if (isset($rows[$key]) && $rows[$key] !== null && $rows[$key] !== '') {
                    $merged[$key] = $rows[$key];
                }
            }

            if (empty($merged['support_email']) && !empty($rows['email'])) {
                $merged['support_email'] = $rows['email'];
            }
            if (empty($merged['support_phone']) && !empty($rows['phone'])) {
                $merged['support_phone'] = $rows['phone'];
            }
            if (empty($merged['office_address']) && !empty($rows['address'])) {
                $merged['office_address'] = $rows['address'];
            }

            $merged['logo_url'] = self::resolveMediaUrl($merged['logo_path'] ?? 'images/default-logo.svg');
            $merged['favicon_url'] = self::resolveMediaUrl($merged['favicon_path'] ?? ($merged['logo_path'] ?? 'images/default-logo.svg'));

            return $merged;
        } catch (\Throwable) {
            $defaults['logo_url'] = asset($defaults['logo_path']);
            $defaults['favicon_url'] = asset($defaults['favicon_path']);
            return $defaults;
        }
    }

    public static function save(array $attributes): void
    {
        $defaults = self::defaults();
        $current = self::all();
        $profile = [];

        foreach (array_keys($defaults) as $key) {
            if (array_key_exists($key, $attributes)) {
                $val = is_string($attributes[$key]) ? trim($attributes[$key]) : $attributes[$key];
                $profile[$key] = $val;
                DB::table('settings')->updateOrInsert(['key' => $key], ['value' => (string) $val]);
            } elseif (isset($current[$key])) {
                $profile[$key] = $current[$key];
            }
        }

        if (isset($profile['support_email'])) {
            DB::table('settings')->updateOrInsert(['key' => 'email'], ['value' => (string) $profile['support_email']]);
        }
        if (isset($profile['support_phone'])) {
            DB::table('settings')->updateOrInsert(['key' => 'phone'], ['value' => (string) $profile['support_phone']]);
        }
        if (isset($profile['office_address'])) {
            DB::table('settings')->updateOrInsert(['key' => 'address'], ['value' => (string) $profile['office_address']]);
        }

        DB::table('settings')->updateOrInsert(
            ['key' => 'brand_profile'],
            ['value' => json_encode($profile, JSON_UNESCAPED_UNICODE)]
        );
    }

    public static function storeUploadedImage(UploadedFile $file, string $prefix = 'brand'): string
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'png');
        if (!in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'ico'], true)) {
            $ext = 'png';
        }
        $dir = public_path('uploads/branding');
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $filename = $prefix . '-' . time() . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $file->move($dir, $filename);

        return 'uploads/branding/' . $filename;
    }

    public static function resolveMediaUrl(?string $path): string
    {
        $clean = trim((string) $path);
        if ($clean === '') {
            return asset('images/default-logo.svg');
        }
        if (Str::startsWith($clean, ['http://', 'https://', '/'])) {
            return $clean;
        }
        return asset($clean);
    }

    public static function formatMoney(int|float|string $amount, ?array $brand = null): string
    {
        $brand ??= self::all();
        $symbol = $brand['currency_symbol'] ?? '$';
        return $symbol . number_format((float) $amount);
    }
}
