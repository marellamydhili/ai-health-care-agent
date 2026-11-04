<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/auth.php';

$config = app_config();
$bootstrapError = null;
try { db_bootstrap(); } catch (Throwable $error) { $bootstrapError = $error; log_api_error($error); }
try { db_ensure_role_profiles(); } catch (Throwable $error) { $bootstrapError = $error; log_api_error($error); }
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && $origin !== $config['cors_origin']) api_error('Origin is not allowed.', 403);
if ($origin !== '') { header("Access-Control-Allow-Origin: {$origin}"); header('Vary: Origin'); header('Access-Control-Allow-Credentials: true'); }
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

try {
    $path = trim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    start_auth_session();

    if ($path === 'api/auth/login' && $method === 'POST') {
        $input = json_input();
        $identifier = strtolower(required_string($input, 'identifier', 320));
        $selectedRole = valid_role(required_string($input, 'role', 20));
        $users = db_find('users');
        $user = current(array_filter($users, static fn(array $item): bool => ($item['email'] ?? '') === $identifier || strtolower((string)($item['username'] ?? '')) === $identifier));
        if (!$user) $user = demo_user($identifier);
        if (!$user || !password_matches($identifier, (string)($input['password'] ?? ''), (string)($user['passwordHash'] ?? ''))) api_error('Account not found or password is incorrect.', 401);
        if (($user['role'] ?? '') !== $selectedRole) api_error('Selected role does not match this account.', 403);
        $_SESSION['user'] = safe_user($user);
        db_insert('audit_logs', ['actorUserId' => $user['userId'] ?? $user['id'], 'action' => 'login', 'collection' => 'users', 'recordId' => $user['id']]);
        api_success(['user' => safe_user($user)], 200);
    }
    if ($path === 'api/auth/register' && $method === 'POST') {
        $input = json_input();
        $email = email_value($input);
        $role = valid_role(required_string($input, 'role', 20));
        if ($role === 'admin') api_error('Administrator accounts cannot be self-registered.', 403);
        if (db_find('users', ['email' => $email])) api_error('An account with this email already exists.', 409);
        $name = trim((string)($input['name'] ?? $input['fullName'] ?? ''));
        if ($name === '') api_error('Invalid name.', 422);
        $user = db_insert('users', ['userId' => db_id('user'), 'email' => $email, 'username' => strtolower((string)($input['username'] ?? '')), 'name' => $name, 'role' => $role, 'passwordHash' => password_hash(required_string($input, 'password', 255), PASSWORD_DEFAULT)]);
        $_SESSION['user'] = safe_user($user);
        db_insert('audit_logs', ['actorUserId' => $user['userId'], 'action' => 'register', 'collection' => 'users', 'recordId' => $user['id']]);
        api_success(['user' => safe_user($user)], 201);
    }
    if ($path === 'api/auth/logout' && $method === 'POST') { $_SESSION = []; session_destroy(); api_success(['loggedOut' => true]); }
    if ($path === 'api/patients' && $method === 'GET') { require_auth(['doctor', 'staff']); api_success(db_find('patients')); }
    if ($path === 'api/doctors' && $method === 'GET') { require_auth(['patient', 'doctor', 'staff']); api_success(db_find('doctors')); }
    if ($path === 'api/staff' && $method === 'GET') { require_auth(['staff']); api_success(db_find('staff')); }
    if ($path === 'api/chat' && $method === 'GET') {
        $user = require_auth(['patient', 'doctor']);
        $patientEmail = strtolower(required_string($_GET, 'patientEmail', 320));
        $doctorEmail = strtolower(required_string($_GET, 'doctorEmail', 320));
        if (($user['role'] ?? '') === 'patient' && strtolower((string)($user['email'] ?? '')) !== $patientEmail) api_error('You can only view your own chat.', 403);
        if (($user['role'] ?? '') === 'doctor' && $doctorEmail !== strtolower((string)($user['email'] ?? '')) && $doctorEmail !== 'maya.patel@carepoint.example') api_error('You can only view chats assigned to you.', 403);
        $messages = db_find('messages', ['conversationKey' => chat_key($patientEmail, $doctorEmail)]);
        usort($messages, static fn(array $first, array $second): int => strcmp((string)($first['createdAt'] ?? ''), (string)($second['createdAt'] ?? '')));
        api_success($messages);
    }
    if ($path === 'api/chat' && $method === 'POST') {
        $user = require_auth(['patient', 'doctor']);
        $input = json_input();
        $patientEmail = strtolower(required_string($input, 'patientEmail', 320));
        $doctorEmail = strtolower(required_string($input, 'doctorEmail', 320));
        $text = required_string($input, 'text', 2000);
        if (($user['role'] ?? '') === 'patient' && strtolower((string)($user['email'] ?? '')) !== $patientEmail) api_error('You can only send messages in your own chat.', 403);
        if (($user['role'] ?? '') === 'doctor' && $doctorEmail !== strtolower((string)($user['email'] ?? '')) && $doctorEmail !== 'maya.patel@carepoint.example') api_error('You can only send messages assigned to you.', 403);
        $message = db_insert('messages', ['messageId' => db_id('message'), 'conversationKey' => chat_key($patientEmail, $doctorEmail), 'patientEmail' => $patientEmail, 'doctorEmail' => $doctorEmail, 'senderRole' => $user['role'], 'senderName' => $user['name'] ?? $user['email'], 'text' => $text]);
        api_success($message, 201);
    }
    api_error('Route not found.', 404);
} catch (Throwable $error) {
    log_api_error($error);
    api_error('Internal server error.', 500);
}

function chat_key(string $patientEmail, string $doctorEmail): string {
    return hash('sha256', strtolower($patientEmail) . '|' . strtolower($doctorEmail));
}
