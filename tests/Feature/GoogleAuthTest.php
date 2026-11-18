<?php

namespace Tests\Feature;

use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private const CLIENT_ID = 'test-client-id';

    private const KID = 'test-key';

    private const OPENSSL_CONFIG = 'C:/xampp/php/extras/openssl/openssl.cnf';

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.google.client_id' => self::CLIENT_ID]);
    }

    protected function refreshTestDatabase()
    {
        if (! RefreshDatabaseState::$migrated) {
            $this->migrateDatabases();

            RefreshDatabaseState::$migrated = true;
        }

        DB::purge('mongodb');

        $this->beginDatabaseTransaction();
    }

    private function keypair(): array
    {
        $rsa = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
            'config' => self::OPENSSL_CONFIG,
        ]);

        $details = openssl_pkey_get_details($rsa);

        return [
            'private' => $rsa,
            'jwks' => [
                'keys' => [
                    [
                        'kid' => self::KID,
                        'kty' => 'RSA',
                        'alg' => 'RS256',
                        'use' => 'sig',
                        'n' => JWT::urlsafeB64Encode($details['rsa']['n']),
                        'e' => JWT::urlsafeB64Encode($details['rsa']['e']),
                    ],
                ],
            ],
        ];
    }

    private function fakeGoogleCerts(array $keypair): void
    {
        Http::fake([
            'https://www.googleapis.com/oauth2/v3/certs' => Http::response(json_encode($keypair['jwks']), 200),
        ]);
    }

    private function sign(array $claims, array $keypair): string
    {
        return JWT::encode($claims, $keypair['private'], 'RS256', self::KID);
    }

    private function validClaims(array $overrides = []): array
    {
        return array_merge(
            [
                'iss' => 'accounts.google.com',
                'aud' => self::CLIENT_ID,
                'sub' => 'google-subject-123',
                'email' => 'cubist@example.com',
                'email_verified' => true,
                'name' => 'The Cubist',
                'picture' => 'https://example.com/avatar.png',
                'iat' => now()->timestamp,
                'exp' => now()->addMinutes(10)->timestamp,
            ],
            $overrides
        );
    }

    private function loginViaGoogle(array $claims, array $keypair): TestResponse
    {
        $this->fakeGoogleCerts($keypair);

        return $this->withoutMiddleware(ThrottleRequests::class)
            ->postJson('/auth/google', ['credential' => $this->sign($claims, $keypair)]);
    }

    public function test_credential_is_required(): void
    {
        $this->postJson('/auth/google')->assertStatus(422);
    }

    public function test_garbage_token_is_rejected(): void
    {
        $this->postJson('/auth/google', ['credential' => 'not-a-jwt'])->assertStatus(422);
    }

    public function test_token_with_wrong_audience_is_rejected(): void
    {
        $claims = $this->validClaims(['aud' => 'some-other-app']);

        $this->loginViaGoogle($claims, $this->keypair())
            ->assertStatus(422)
            ->assertJsonMissingPath('ok');
    }

    public function test_valid_token_creates_user_and_logs_in(): void
    {
        $this->loginViaGoogle($this->validClaims(), $this->keypair())->assertStatus(200);

        $user = User::where('google_id', 'google-subject-123')->first();

        $this->assertNotNull($user);
        $this->assertSame('cubist@example.com', $user->email);
        $this->assertSame('The Cubist', $user->name);
        $this->assertSame('https://example.com/avatar.png', $user->avatar);
        $this->assertNotNull($user->email_verified_at);
        $this->assertAuthenticatedAs($user);
    }

    public function test_existing_user_profile_is_synced_on_login(): void
    {
        $user = User::factory()->create([
            'google_id' => 'google-subject-123',
            'email' => 'cubist@example.com',
            'name' => 'Old Name',
        ]);

        $claims = $this->validClaims(['name' => 'New Name']);

        $this->loginViaGoogle($claims, $this->keypair())->assertStatus(200);

        $this->assertSame('New Name', $user->fresh()->name);
        $this->assertCount(1, User::where('google_id', 'google-subject-123')->get());
    }

    public function test_email_collision_with_other_google_account_is_rejected(): void
    {
        User::factory()->create([
            'google_id' => 'other-subject',
            'email' => 'cubist@example.com',
        ]);

        $this->loginViaGoogle($this->validClaims(), $this->keypair())
            ->assertStatus(422)
            ->assertJsonPath('message', 'That email is already linked to another Google account.');
    }
}
