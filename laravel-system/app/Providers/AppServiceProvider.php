<?php

namespace App\Providers;

use App\Support\BrandSettings;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Allow fresh pre-install requests (/install) to run cleanly on domain hosting even before .env or database tables exist.
        if (!file_exists(storage_path('installed.lock'))) {
            $installKeyPath = storage_path('framework/install.key');

            if (empty(config('app.key'))) {
                if (!is_dir(dirname($installKeyPath))) {
                    @mkdir(dirname($installKeyPath), 0775, true);
                }
                $key = is_file($installKeyPath) ? trim((string) @file_get_contents($installKeyPath)) : '';
                if ($key === '') {
                    $key = 'base64:' . base64_encode(random_bytes(32));
                    @file_put_contents($installKeyPath, $key);
                }
                config(['app.key' => $key]);
            }

            if (!$this->app->runningUnitTests()) {
                config([
                    'session.driver' => 'file',
                    'cache.default' => 'file',
                ]);
            }
        }

        View::composer('*', function ($view) {
            $view->with('brand', BrandSettings::all());
        });
    }
}
