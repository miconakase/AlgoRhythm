<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;

class GoogleAuthController extends Controller
{
    private const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

    /**
     * Show the Google sign-in page.
     */
    public function create(): Response
    {
        return Inertia::render('Login');
    }

    /**
     * Verify a Google ID token credential and sign the user in.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'credential' => ['required', 'string'],
        ]);

        try {
            $jwks = Cache::remember('google-jwks', now()->addDay(), function () {
                return Http::get(self::GOOGLE_JWKS_URL)->json();
            });

            $payload = JWT::decode($data['credential'], JWK::parseKeySet($jwks, 'RS256'));
        } catch (\Throwable) {
            return $this->reject('Sign-in failed — please try again.');
        }

        if (
            $payload->aud !== config('services.google.client_id')
            || ! in_array($payload->iss, ['accounts.google.com', 'https://accounts.google.com'])
            || ! isset($payload->email)
        ) {
            return $this->reject('Sign-in failed — please try again.');
        }

        if (User::where('email', $payload->email)->where('google_id', '!=', $payload->sub)->exists()) {
            return $this->reject('That email is already linked to another Google account.');
        }

        $user = User::updateOrCreate(
            ['google_id' => $payload->sub],
            [
                'name' => $payload->name ?? 'Cube Enthusiast',
                'email' => $payload->email,
                'avatar' => $payload->picture ?? null,
            ]
        );

        if (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        Auth::login($user);

        return response()->json(['ok' => true]);
    }

    /**
     * Sign the current user out.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('timer');
    }

    private function reject(string $message): JsonResponse
    {
        return response()->json(['message' => $message], 422);
    }
}
