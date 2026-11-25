<?php

namespace App\Http\Controllers;

use App\Models\BackupSnapshot;
use App\Services\SystemUpdateService;
use Illuminate\Http\Request;

class SystemUpdateController extends Controller
{
    public function __construct(private readonly SystemUpdateService $updater)
    {
    }

    public function createFullBackup(Request $request)
    {
        $label = trim((string) $request->input('label', 'Full Non-Destructive System Backup'));
        $result = $this->updater->createFullBackup($request->user()->name, $label ?: 'Full Non-Destructive System Backup');

        return back()->with('status', "Full verified backup created (#{$result['snapshot']->id}, SHA-256: " . substr($result['checksum'], 0, 12) . "...).");
    }

    public function downloadBackup(BackupSnapshot $snapshot)
    {
        $filename = 'lms-backup-' . $snapshot->id . '-' . now()->format('Ymd-His') . '.json';
        return response($snapshot->payload_json, 200, [
            'Content-Type' => 'application/json',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public function restoreBackup(Request $request, BackupSnapshot $snapshot)
    {
        try {
            $counts = $this->updater->restoreBackupSnapshot($snapshot, $request->user()->name);
            $totalRows = array_sum($counts);
            return back()->with('status', "Backup #{$snapshot->id} verified and restored cleanly ({$totalRows} records restored across " . count($counts) . " tables).");
        } catch (\Throwable $e) {
            return back()->withErrors(['update' => $e->getMessage()]);
        }
    }

    public function runMigrations(Request $request)
    {
        try {
            $res = $this->updater->runPendingMigrationsSafely($request->user()->name);
            $applied = count($res['migrations_applied']);
            $msg = $applied > 0
                ? "Applied {$applied} new database migration(s) safely after creating Backup #{$res['backup_id']}. All existing records preserved."
                : "Database schema is already up to date (Backup #{$res['backup_id']} saved).";
            return back()->with('status', $msg);
        } catch (\Throwable $e) {
            return back()->withErrors(['update' => 'Migration failed: ' . $e->getMessage()]);
        }
    }

    public function applyUpdate(Request $request)
    {
        $request->validate([
            'update_package' => 'required|file|mimes:zip|max:51200',
        ]);

        $file = $request->file('update_package');
        $packageName = $file->getClientOriginalName();

        try {
            $record = $this->updater->applyUpdateZip(
                $file->getRealPath(),
                $packageName,
                $request->user()->name
            );

            $migratedCount = count($record->migrations_applied ?? []);
            return back()->with(
                'status',
                "System updated cleanly from v{$record->from_version} to v{$record->to_version} ({$record->files_updated_count} file(s) updated, {$migratedCount} incremental migration(s) applied). Pre-update Backup #{$record->backup_snapshot_id} preserved all database records & uploads."
            );
        } catch (\Throwable $e) {
            return back()->withErrors(['update' => 'Update safely rolled back: ' . $e->getMessage()]);
        }
    }
}
