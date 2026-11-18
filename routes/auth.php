<?php

use App\Http\Controllers\Auth\GoogleAuthController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('login', [GoogleAuthController::class, 'create'])
        ->name('login');

    Route::post('auth/google', [GoogleAuthController::class, 'store'])
        ->middleware('throttle:5,1')
        ->name('auth.google');
});

Route::middleware('auth')->group(function () {
    Route::post('logout', [GoogleAuthController::class, 'destroy'])
        ->name('logout');
});
