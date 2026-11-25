<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\User;
use App\Support\BrandSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function showLogin(Request $request, ?string $role = null)
    {
        return $this->renderAuthView($request, 'login', $role);
    }

    public function showRegister(Request $request, ?string $role = null)
    {
        return $this->renderAuthView($request, 'register', $role);
    }

    public function showRecover(Request $request, ?string $role = null)
    {
        return $this->renderAuthView($request, 'recover', $role);
    }

    private function renderAuthView(Request $request, string $mode, ?string $role = null)
    {
        $allowedRoles = ['student', 'guardian', 'teacher', 'branch', 'admin'];
        $selectedRole = $role ?? (string) $request->query('role', 'student');
        if (!in_array($selectedRole, $allowedRoles, true)) {
            $selectedRole = 'student';
        }
        if ($mode === 'register' && $selectedRole === 'admin') {
            $selectedRole = 'student';
        }
        $branches = Branch::where('status', 'active')->get();
        return view('auth.login', compact('branches', 'mode', 'selectedRole'));
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'expected_role' => 'nullable|in:admin,branch,teacher,student,guardian',
        ]);

        $user = User::where('email', strtolower(trim($credentials['email'])))->first();
        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return back()->withErrors(['email' => 'Invalid email or password.'])->onlyInput('email');
        }

        if (!empty($credentials['expected_role']) && $user->role !== $credentials['expected_role']) {
            return back()
                ->withErrors(['email' => "This account belongs to the '{$user->role}' portal. Please switch to the matching role tab."])
                ->onlyInput('email');
        }

        $status = (string) ($user->status ?? 'active');
        if ($status === 'pending') {
            return back()
                ->withErrors(['email' => 'Your account is pending Main Admin approval. Please check back once approved.'])
                ->onlyInput('email');
        }
        if (in_array($status, ['rejected', 'suspended'], true)) {
            return back()
                ->withErrors(['email' => "Your account status is '{$status}'. Please contact the Main Admin."])
                ->onlyInput('email');
        }

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();
        return redirect()->intended(route('portal.index'));
    }

    public function register(Request $request)
    {
        $hasBranches = Branch::where('status', 'active')->exists();

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string|max:30',
            'role' => 'required|in:student,guardian,teacher,branch',
            'branch_id' => ($hasBranches && $request->input('role') !== 'branch') ? 'required|exists:branches,id' : 'nullable|exists:branches,id',
            'student_roll_link' => 'nullable|string|max:60',
            'student_verification' => 'nullable|string|max:80',
            'education' => 'nullable|string|max:180',
            'subject_specialty' => 'nullable|string|max:120',
            'bio' => 'nullable|string|max:1000',
            'branch_name' => 'nullable|string|max:140',
            'branch_code' => 'nullable|string|max:32',
            'branch_city' => 'nullable|string|max:80',
            'branch_address' => 'nullable|string|max:240',
            'password' => 'required|string|min:6',
        ]);

        $linkedStudent = null;
        if ($data['role'] === 'guardian' && !empty(trim((string) ($data['student_roll_link'] ?? '')))) {
            $rollUpper = strtoupper(trim((string) $data['student_roll_link']));
            $linkedStudent = User::where('role', 'student')
                ->where('roll_number', $rollUpper)
                ->first();

            if (!$linkedStudent) {
                return back()->withInput()->withErrors([
                    'student_roll_link' => 'No matching student account was found for that roll ID.',
                ]);
            }

            $verification = trim((string) ($data['student_verification'] ?? ''));
            $normInputDigits = self::normalizePhoneDigits($verification);
            $normStudentDigits = self::normalizePhoneDigits((string) $linkedStudent->phone);
            $expectedCode = self::guardianLinkCode($linkedStudent);

            $phoneMatches = $normInputDigits !== '' && $normStudentDigits !== '' && $normInputDigits === $normStudentDigits;
            $codeMatches = $verification !== '' && hash_equals($expectedCode, strtoupper($verification));

            if (!$phoneMatches && !$codeMatches) {
                return back()->withInput()->withErrors([
                    'student_verification' => 'Guardian linking requires the student registered phone number or verified linking code.',
                ]);
            }
        }

        $branchId = $data['branch_id'] ?? null;
        if ($data['role'] === 'branch' && empty($branchId)) {
            $branchName = trim((string) ($data['branch_name'] ?? $data['name'] . ' Campus'));
            $rawCode = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($data['branch_code'] ?? '')) ?: 'BR');
            $candidateCode = substr($rawCode, 0, 12);
            if (Branch::where('code', $candidateCode)->exists()) {
                $candidateCode = substr($candidateCode, 0, 8) . random_int(100, 999);
            }
            $createdBranch = Branch::create([
                'name' => $branchName,
                'code' => $candidateCode,
                'city' => trim((string) ($data['branch_city'] ?? 'Regional')) ?: 'Regional',
                'address' => trim((string) ($data['branch_address'] ?? 'Submitted during registration')) ?: 'Submitted during registration',
                'phone' => $data['phone'],
                'manager_name' => $data['name'],
                'active_students' => 0,
                'status' => 'inactive',
            ]);
            $branchId = $createdBranch->id;
        }

        $brand = BrandSettings::all();
        $prefix = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($brand['roll_prefix'] ?? 'STD')) ?: 'STD');

        $rollNumber = null;
        if ($data['role'] === 'student') {
            do {
                $candidate = $prefix . '-' . date('Y') . '-' . random_int(1000, 9999);
            } while (User::where('roll_number', $candidate)->exists());
            $rollNumber = $candidate;
        }

        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower(trim($data['email'])),
            'phone' => $data['phone'],
            'role' => $data['role'],
            'status' => 'pending',
            'branch_id' => $branchId,
            'roll_number' => $rollNumber,
            'education' => $data['education'] ?? null,
            'subject_specialty' => $data['subject_specialty'] ?? null,
            'bio' => $data['bio'] ?? null,
            'password' => Hash::make($data['password']),
        ]);

        if ($linkedStudent) {
            DB::table('guardian_student')->insertOrIgnore([
                'guardian_id' => $user->id,
                'student_id' => $linkedStudent->id,
            ]);
        }

        return redirect()
            ->route('login', ['role' => $data['role']])
            ->with('status', 'Registration submitted and pending Main Admin approval.');
    }

    public function requestPasswordReset(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'expected_role' => 'nullable|in:admin,branch,teacher,student,guardian',
        ]);

        $user = User::where('email', strtolower(trim($data['email'])))->first();
        if ($user && (empty($data['expected_role']) || $user->role === $data['expected_role'])) {
            $rawToken = strtoupper(bin2hex(random_bytes(5)));
            $user->update([
                'password_reset_token_hash' => hash('sha256', $rawToken),
                'password_reset_expires_at' => now()->addHour(),
            ]);
        }

        return redirect()
            ->route('recover', ['role' => $data['expected_role'] ?? 'student'])
            ->with('status', 'If a matching account exists, a recovery token has been issued. Contact the Main Admin if you need assisted token issuance.');
    }

    public function confirmPasswordReset(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string|min:6|max:64',
            'password' => 'required|string|min:6',
            'expected_role' => 'nullable|in:admin,branch,teacher,student,guardian',
        ]);

        $user = User::where('email', strtolower(trim($data['email'])))->first();
        if (
            !$user ||
            (!empty($data['expected_role']) && $user->role !== $data['expected_role']) ||
            empty($user->password_reset_token_hash) ||
            !$user->password_reset_expires_at ||
            now()->greaterThan($user->password_reset_expires_at)
        ) {
            return back()->withInput()->withErrors(['token' => 'Invalid or expired recovery token.']);
        }

        $candidateHash = hash('sha256', strtoupper(trim($data['token'])));
        if (!hash_equals($user->password_reset_token_hash, $candidateHash)) {
            return back()->withInput()->withErrors(['token' => 'Invalid or expired recovery token.']);
        }

        $user->update([
            'password' => Hash::make($data['password']),
            'password_reset_token_hash' => null,
            'password_reset_expires_at' => null,
        ]);

        return redirect()
            ->route('login', ['role' => $user->role])
            ->with('status', 'Password updated successfully. You may now sign in.');
    }

    public static function guardianLinkCode(User $student): string
    {
        $key = (string) config('app.key', 'edupro-laravel-key');
        return 'STD-' . strtoupper(substr(hash_hmac('sha256', $student->id . '|' . $student->email, $key), 0, 6));
    }

    private static function normalizePhoneDigits(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '8801') && strlen($digits) === 13) {
            return '0' . substr($digits, 3);
        }
        return $digits;
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('home');
    }
}
