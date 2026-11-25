<?php

use App\Services\SystemUpdateService;
use Illuminate\Support\Facades\Artisan;

Artisan::command('system:update {zip : Path to the ZIP update package}', function (string $zip, SystemUpdateService $updater) {
    if (!is_file($zip)) {
        $this->error("Update package not found: {$zip}");
        return 1;
    }

    $this->info('Inspecting update package & creating pre-update database + .env backup...');
    $record = $updater->applyUpdateZip($zip, basename($zip), 'CLI Artisan');
    $this->info("Updated from v{$record->from_version} to v{$record->to_version} ({$record->files_updated_count} files updated).");
    return 0;
})->purpose('Apply a non-destructive update ZIP while preserving database records, .env, and uploads');
