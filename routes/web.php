<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BatchEnterpriseController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ExamController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\PortalController;
use App\Http\Controllers\PublicController;
use App\Http\Controllers\ShopController;
use App\Http\Controllers\SystemUpdateController;
use Illuminate\Support\Facades\Route;

// Ready-to-Install Web Wizard (automatically locked after storage/installed.lock exists)
Route::prefix('install')->group(function () {
    Route::get('/', [InstallController::class, 'index'])->name('install.index');
    Route::post('/run', [InstallController::class, 'install'])->name('install.run');
});

// Public Pages
Route::get('/', [PublicController::class, 'home'])->name('home');
Route::get('/courses', [PublicController::class, 'courses'])->name('courses.index');
Route::get('/course/{slug}', [PublicController::class, 'courseDetail'])->name('courses.show');
Route::get('/instructors', [PublicController::class, 'instructors'])->name('instructors');
Route::get('/products', [ShopController::class, 'products'])->name('products');
Route::get('/ebooks', [ShopController::class, 'ebooks'])->name('ebooks');
Route::get('/board-result', [PublicController::class, 'results'])->name('results');
Route::post('/board-result/lookup', [PublicController::class, 'lookupResult'])->middleware('throttle:30,5')->name('results.lookup');
Route::get('/community', [PublicController::class, 'community'])->name('community');
Route::post('/community/{post}/like', [PublicController::class, 'likeCommunityPost'])->name('community.like');
Route::get('/verify-certificate', [PublicController::class, 'verifyCertificate'])->name('certificates.verify');
Route::post('/verify-certificate', [PublicController::class, 'lookupCertificate'])->middleware('throttle:30,5')->name('certificates.lookup');
Route::post('/payments/webhook/{gateway}', [PublicController::class, 'paymentWebhook'])->name('payments.webhook');

// Auth, Self-Registration & Account Recovery
Route::get('/login/{role?}', [AuthController::class, 'showLogin'])->name('login');
Route::get('/register/{role?}', [AuthController::class, 'showRegister'])->name('register');
Route::get('/recover/{role?}', [AuthController::class, 'showRecover'])->name('recover');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:15,5')->name('login.post');
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:15,5')->name('register.post');
Route::post('/recover/request', [AuthController::class, 'requestPasswordReset'])->middleware('throttle:10,5')->name('recover.request');
Route::post('/recover/confirm', [AuthController::class, 'confirmPasswordReset'])->middleware('throttle:10,5')->name('recover.confirm');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

// Authenticated Learning, Commerce & Multi-Role Portal Routes
Route::middleware('auth')->group(function () {
    Route::get('/learn', [PublicController::class, 'learn'])->name('learn');
    Route::post('/learn/progress', [PublicController::class, 'markLessonComplete'])->name('learn.progress');

    Route::post('/courses/{course}/enroll', [PublicController::class, 'enroll'])->name('courses.enroll');

    Route::get('/exams', [ExamController::class, 'index'])->name('exams.index');
    Route::post('/exams/{exam}/submit', [ExamController::class, 'submit'])->name('exams.submit');

    Route::post('/shop/order', [ShopController::class, 'placeOrder'])->name('shop.order');
    Route::post('/ebooks/{ebook}/claim', [ShopController::class, 'claimEbook'])->middleware('role:student')->name('ebooks.claim');

    // Unified Multi-Role Portal (/portal)
    Route::prefix('portal')->group(function () {
        Route::get('/', [PortalController::class, 'index'])->name('portal.index');

        Route::middleware('role:admin')->group(function () {
            // White-Label Branding & Self-Serve Config
            Route::post('/branding', [PortalController::class, 'updateBranding'])->name('portal.branding.update');

            // Non-Destructive System Updates & Verified Full Backups
            Route::post('/updates/backup', [SystemUpdateController::class, 'createFullBackup'])->name('portal.updates.backup');
            Route::get('/updates/backup/{snapshot}/download', [SystemUpdateController::class, 'downloadBackup'])->name('portal.updates.backup.download');
            Route::post('/updates/backup/{snapshot}/restore', [SystemUpdateController::class, 'restoreBackup'])->name('portal.updates.backup.restore');
            Route::post('/updates/migrate', [SystemUpdateController::class, 'runMigrations'])->name('portal.updates.migrate');
            Route::post('/updates/apply', [SystemUpdateController::class, 'applyUpdate'])->name('portal.updates.apply');

            // Courses & Categories
            Route::post('/courses', [PortalController::class, 'storeCourse'])->name('portal.courses.store');
            Route::put('/courses/{course}', [PortalController::class, 'updateCourse'])->name('portal.courses.update');
            Route::patch('/courses/{course}/status', [PortalController::class, 'toggleCourseStatus'])->name('portal.courses.status');
            Route::post('/courses/{course}/duplicate', [PortalController::class, 'duplicateCourse'])->name('portal.courses.duplicate');
            Route::delete('/courses/{course}', [PortalController::class, 'deleteCourse'])->name('portal.courses.delete');
            Route::post('/categories', [CategoryController::class, 'store'])->name('portal.categories.store');
            Route::patch('/categories/{category}/toggle', [CategoryController::class, 'toggle'])->name('portal.categories.toggle');
            Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->name('portal.categories.delete');

            // Branches
            Route::post('/branches', [PortalController::class, 'storeBranch'])->name('portal.branches.store');
            Route::put('/branches/{branch}', [PortalController::class, 'updateBranch'])->name('portal.branches.update');
            Route::patch('/branches/{branch}/status', [PortalController::class, 'toggleBranchStatus'])->name('portal.branches.status');
            Route::delete('/branches/{branch}', [PortalController::class, 'deleteBranch'])->name('portal.branches.delete');

            // Payment Gateways & Connectors
            Route::post('/payment-gateways', [PortalController::class, 'storePaymentGateway'])->name('portal.gateways.store');
            Route::put('/payment-gateways/{id}', [PortalController::class, 'updatePaymentGateway'])->name('portal.gateways.update');
            Route::patch('/payment-gateways/{id}/status', [PortalController::class, 'togglePaymentGateway'])->name('portal.gateways.status');
            Route::delete('/payment-gateways/{id}', [PortalController::class, 'deletePaymentGateway'])->name('portal.gateways.delete');
            Route::post('/connectors', [PortalController::class, 'storeConnector'])->name('portal.connectors.store');
            Route::put('/connectors/{id}', [PortalController::class, 'updateConnector'])->name('portal.connectors.update');
            Route::patch('/connectors/{id}/status', [PortalController::class, 'toggleConnector'])->name('portal.connectors.status');
            Route::delete('/connectors/{id}', [PortalController::class, 'deleteConnector'])->name('portal.connectors.delete');

            // Users, Approvals, Password Recovery Tokens, Store, Ebooks, Results, Certificates, Community, Finance
            Route::post('/users', [PortalController::class, 'storeUser'])->name('portal.users.store');
            Route::patch('/users/{user}', [PortalController::class, 'updateUser'])->name('portal.users.update');
            Route::post('/users/{user}/approve', [PortalController::class, 'approveUser'])->name('portal.users.approve');
            Route::post('/users/{user}/reject', [PortalController::class, 'rejectUser'])->name('portal.users.reject');
            Route::post('/users/{user}/reset-token', [PortalController::class, 'issueResetToken'])->name('portal.users.reset_token');
            Route::patch('/users/{user}/role', [PortalController::class, 'updateUserRole'])->name('portal.users.role');
            Route::delete('/users/{user}', [PortalController::class, 'deleteUser'])->name('portal.users.delete');
            Route::post('/products', [PortalController::class, 'storeProduct'])->name('portal.products.store');
            Route::delete('/products/{product}', [PortalController::class, 'deleteProduct'])->name('portal.products.delete');
            Route::post('/ebooks', [PortalController::class, 'storeEbook'])->name('portal.ebooks.store');
            Route::delete('/ebooks/{ebook}', [PortalController::class, 'deleteEbook'])->name('portal.ebooks.delete');
            Route::post('/results', [PortalController::class, 'storeCenterResult'])->name('portal.results.store');
            Route::delete('/results/{result}', [PortalController::class, 'deleteCenterResult'])->name('portal.results.delete');
            Route::post('/certificates', [PortalController::class, 'issueCertificate'])->name('portal.certificates.store');
            Route::patch('/certificates/{certificate}/revoke', [PortalController::class, 'revokeCertificate'])->name('portal.certificates.revoke');
            Route::post('/community', [PortalController::class, 'storeCommunityPost'])->name('portal.community.store');
            Route::delete('/community/{post}', [PortalController::class, 'deleteCommunityPost'])->name('portal.community.delete');
            Route::post('/finance', [PortalController::class, 'storeFinancialRecord'])->name('portal.finance.store');

            // Settings, Menu, Homepage CMS, Reviews, Coupons, Backups & Recycle Bin
            Route::post('/settings', [PortalController::class, 'updateSettings'])->name('portal.settings');
            Route::post('/header-menu', [PortalController::class, 'updateHeaderMenu'])->name('portal.menu.update');
            Route::post('/homepage/slides', [PortalController::class, 'storeHomepageSlide'])->name('portal.homepage.slides.store');
            Route::delete('/homepage/slides/{index}', [PortalController::class, 'deleteHomepageSlide'])->name('portal.homepage.slides.delete');
            Route::post('/homepage/config', [PortalController::class, 'updateHomepageConfig'])->name('portal.homepage.config');
            Route::post('/reviews', [PortalController::class, 'storeReview'])->name('portal.reviews.store');
            Route::put('/reviews/{review}', [PortalController::class, 'updateReview'])->name('portal.reviews.update');
            Route::patch('/reviews/{review}/status', [PortalController::class, 'updateReviewStatus'])->name('portal.reviews.status');
            Route::delete('/reviews/{review}', [PortalController::class, 'deleteReview'])->name('portal.reviews.delete');
            Route::post('/coupons', [PortalController::class, 'storeCoupon'])->name('portal.coupons.store');
            Route::delete('/coupons/{coupon}', [PortalController::class, 'deleteCoupon'])->name('portal.coupons.delete');
            Route::post('/backups', [PortalController::class, 'createVerifiedBackup'])->name('portal.backups.store');
            Route::post('/recycle-bin/{item}/restore', [PortalController::class, 'restoreRecycleBin'])->name('portal.recycle.restore');
            Route::delete('/recycle-bin/{item}', [PortalController::class, 'purgeRecycleBin'])->name('portal.recycle.purge');
        });

        Route::post('/rewards/privacy', [PortalController::class, 'toggleLeaderboardPrivacy'])->name('portal.rewards.privacy');

        Route::middleware('role:admin,teacher,branch')->group(function () {
            Route::get('/batches/dashboard', [BatchEnterpriseController::class, 'dashboard'])->name('portal.batches.dashboard');
            Route::post('/batches/check-conflicts', [BatchEnterpriseController::class, 'checkConflicts'])->name('portal.batches.conflicts');
            Route::post('/batches/enterprise', [BatchEnterpriseController::class, 'store'])->name('portal.batches.enterprise.store');
            Route::put('/batches/{batch}/enterprise', [BatchEnterpriseController::class, 'update'])->name('portal.batches.enterprise.update');
            Route::post('/batches/{batch}/students/enroll', [BatchEnterpriseController::class, 'enrollStudent'])->name('portal.batches.enroll');
            Route::post('/batches/{batch}/students/transfer', [BatchEnterpriseController::class, 'transferStudent'])->name('portal.batches.transfer');
            Route::post('/batches/{batch}/waitlist/{waitlist}/promote', [BatchEnterpriseController::class, 'promoteWaitlist'])->name('portal.batches.waitlist.promote');
            Route::post('/batches/{batch}/attendance/bulk', [BatchEnterpriseController::class, 'bulkAttendance'])->name('portal.batches.attendance.bulk');
            Route::post('/batches/{batch}/announcements', [BatchEnterpriseController::class, 'addAnnouncement'])->name('portal.batches.announcements.store');
            Route::patch('/batches/{batch}/lifecycle', [BatchEnterpriseController::class, 'updateLifecycle'])->name('portal.batches.lifecycle');
            Route::delete('/batches/{batch}/safe', [BatchEnterpriseController::class, 'safeDestroy'])->name('portal.batches.safe_delete');
            Route::post('/batches', [PortalController::class, 'storeBatch'])->name('portal.batches.store');
            Route::put('/batches/{batch}', [PortalController::class, 'updateBatch'])->name('portal.batches.update');
            Route::patch('/batches/{batch}/status', [PortalController::class, 'toggleBatchStatus'])->name('portal.batches.status');
            Route::delete('/batches/{batch}', [PortalController::class, 'deleteBatch'])->name('portal.batches.delete');
            Route::post('/attendance', [PortalController::class, 'recordAttendance'])->name('portal.attendance.store');
        });

        Route::middleware('role:admin,teacher')->group(function () {
            Route::post('/lessons', [PortalController::class, 'storeLesson'])->name('portal.lessons.store');
            Route::put('/lessons/{lesson}', [PortalController::class, 'updateLesson'])->name('portal.lessons.update');
            Route::patch('/lessons/{lesson}/live-status', [PortalController::class, 'updateLessonLiveStatus'])->name('portal.lessons.live_status');
            Route::post('/lessons/{lesson}/duplicate', [PortalController::class, 'duplicateLesson'])->name('portal.lessons.duplicate');
            Route::delete('/lessons/{lesson}', [PortalController::class, 'deleteLesson'])->name('portal.lessons.delete');
            Route::post('/exams', [PortalController::class, 'storeExam'])->name('portal.exams.store');
            Route::post('/question-bank/bulk', [PortalController::class, 'bulkImportQuestions'])->name('portal.question_bank.bulk');
            Route::post('/exams/from-bank', [PortalController::class, 'buildExamFromBank'])->name('portal.exams.from_bank');
        });

        Route::middleware('role:admin,branch')->group(function () {
            Route::patch('/enrollments/{enrollment}', [PortalController::class, 'decideEnrollment'])->name('portal.enrollments.decide');
            Route::patch('/orders/{order}', [PortalController::class, 'updateOrder'])->name('portal.orders.update');
            Route::post('/payroll', [PortalController::class, 'generatePayroll'])->name('portal.payroll.store');
            Route::patch('/payroll/{payroll}/paid', [PortalController::class, 'markPayrollPaid'])->name('portal.payroll.paid');
        });
    });
});
