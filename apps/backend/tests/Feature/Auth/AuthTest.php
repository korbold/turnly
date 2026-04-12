<?php

use App\Infrastructure\Persistence\Models\UserModel;

test('user can register', function () {
    $response = $this->postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertStatus(201)
        ->assertJsonStructure(['data' => ['user' => ['id', 'name', 'email'], 'token']]);
});

test('user can login', function () {
    UserModel::factory()->create([
        'email' => 'test@example.com',
        'password' => 'password123',
    ]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'test@example.com',
        'password' => 'password123',
    ]);

    $response->assertOk()
        ->assertJsonStructure(['data' => ['user', 'token']]);
});

test('login fails with wrong password', function () {
    UserModel::factory()->create([
        'email' => 'test@example.com',
        'password' => 'password123',
    ]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'test@example.com',
        'password' => 'wrongpassword',
    ]);

    $response->assertStatus(401)
        ->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
});

test('login fails with unknown email', function () {
    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'nobody@example.com',
        'password' => 'password123',
    ]);

    $response->assertStatus(401)
        ->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
});

test('user can logout', function () {
    $user = UserModel::factory()->create();
    $token = $user->createToken('auth_token')->plainTextToken;

    $response = $this->withToken($token)
        ->postJson('/api/v1/auth/logout');

    $response->assertOk();
});

test('register requires all mandatory fields', function () {
    $response = $this->postJson('/api/v1/auth/register', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'email', 'password']);
});

test('register fails with duplicate email', function () {
    UserModel::factory()->create(['email' => 'dup@example.com']);

    $response = $this->postJson('/api/v1/auth/register', [
        'name' => 'Another User',
        'email' => 'dup@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});
