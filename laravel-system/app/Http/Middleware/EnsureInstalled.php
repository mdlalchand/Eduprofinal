<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInstalled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (file_exists(storage_path('framework/updating.flag')) && !$request->is('up')) {
            return response()->view('errors.updating', [], 503);
        }

        if ($request->is('up')) {
            return $next($request);
        }

        $installed = file_exists(storage_path('installed.lock'));

        if (!$installed && !$request->is('install*')) {
            return redirect()->route('install.index');
        }

        if ($installed && $request->is('install*')) {
            return redirect()->route('home');
        }

        return $next($request);
    }
}
