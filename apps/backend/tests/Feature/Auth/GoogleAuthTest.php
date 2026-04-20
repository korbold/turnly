<?php

use App\Infrastructure\Persistence\Models\UserModel;

it('rejects request without id_token', function () {
    $response = $this->postJson('/api/v1/auth/google', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['id_token']);
});

it('rejects invalid google id_token', function () {
    $response = $this->postJson('/api/v1/auth/google', [
        'id_token' => 'invalid-token-string',
    ]);

    $response->assertStatus(401)
        ->assertJson([
            'error' => [
                'code' => 'INVALID_GOOGLE_TOKEN',
            ],
        ]);
});

it('creates new user and returns token for valid google sign-in', function () {
    $mockPayload = [
        'sub' => '110248495921238986420',
        'email' => 'newuser@gmail.com',
        'name' => 'New User',
        'picture' => 'https://lh3.googleusercontent.com/photo.jpg',
        'email_verified' => true,
    ];

    $mockClient = Mockery::mock(\Google\Client::class);
    $mockClient->shouldReceive('setClientId')->once();
    $mockClient->shouldReceive('verifyIdToken')
        ->with('valid-google-token')
        ->once()
        ->andReturn($mockPayload);

    $this->app->instance(\Google\Client::class, $mockClient);

    $response = $this->postJson('/api/v1/auth/google', [
        'id_token' => 'valid-google-token',
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'user' => ['id', 'name', 'email', 'is_super_admin'],
                'token',
            ],
        ]);

    expect($response->json('data.user.email'))->toBe('newuser@gmail.com');
    expect($response->json('data.user.name'))->toBe('New User');

    $this->assertDatabaseHas('users', [
        'email' => 'newuser@gmail.com',
        'name' => 'New User',
    ]);
});

it('logs in existing user for valid google sign-in', function () {
    $existing = UserModel::create([
        'name' => 'Existing User',
        'email' => 'existing@gmail.com',
        'password' => 'some-password',
    ]);

    $mockPayload = [
        'sub' => '110248495921238986420',
        'email' => 'existing@gmail.com',
        'name' => 'Existing User Google Name',
        'picture' => 'https://lh3.googleusercontent.com/photo.jpg',
        'email_verified' => true,
    ];

    $mockClient = Mockery::mock(\Google\Client::class);
    $mockClient->shouldReceive('setClientId')->once();
    $mockClient->shouldReceive('verifyIdToken')
        ->with('valid-google-token')
        ->once()
        ->andReturn($mockPayload);

    $this->app->instance(\Google\Client::class, $mockClient);

    $response = $this->postJson('/api/v1/auth/google', [
        'id_token' => 'valid-google-token',
    ]);

    $response->assertStatus(200);

    expect($response->json('data.user.id'))->toBe($existing->id);
    expect($response->json('data.user.email'))->toBe('existing@gmail.com');
    expect(UserModel::where('email', 'existing@gmail.com')->count())->toBe(1);
});
