<?php
declare(strict_types=1);

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/response.php';

function start_auth_session(): void {
    $config = app_config();
    session_name($config['session_name']);
    session_set_cookie_params(['httponly' => true, 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Lax']);
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    if (isset($_SESSION['expiresAt']) && $_SESSION['expiresAt'] <= time()) {
        $_SESSION = [];
        session_destroy();
        session_start();
    }
    $_SESSION['expiresAt'] = time() + 1800;
}
function safe_user(array $user): array { unset($user['password'], $user['passwordHash'], $user['_id']); return $user; }
function demo_password_hash(string $email): ?string {
    return [
        'patient@carepoint.demo' => '$2b$12$AAaDHw.nQW2wrF4lcuhJRee0nUoFnc.b.OSUUSg1VxCvlFJhCasiO',
        'doctor@carepoint.demo' => '$2b$12$8NTliWLJk7V21TJ28GRTUe8hHjZDBZ0vugkRhamavJ01diOVxn.C',
        'staff@carepoint.demo' => '$2b$12$sk/h5WWXVBAwsSRRBI/G.efhN70Xh8O3D95Dl5WP3c6PJ6fhpNQKC',
        'admin@carepoint.demo' => '$2b$12$JdohKeQgCpPdvpI7Kj2ojuhZpjIKmqEaG/a0PngmwDktMajM8xtMC'
    ][$email] ?? null;
}
function password_matches(string $email, string $password, string $storedHash): bool {
    return password_verify($password, $storedHash) || ($demoHash = demo_password_hash($email)) !== null && password_verify($password, $demoHash);
}
function demo_user(string $email): ?array {
    $users = ['patient@carepoint.demo' => ['Alex Morgan', 'patient'], 'doctor@carepoint.demo' => ['Dr. Maya Patel', 'doctor'], 'staff@carepoint.demo' => ['Carepoint Staff', 'staff'], 'admin@carepoint.demo' => ['Carepoint Admin', 'admin']];
    if (!isset($users[$email])) return null;
    return ['id' => 'demo-' . $users[$email][1], 'userId' => 'demo-' . $users[$email][1], 'email' => $email, 'name' => $users[$email][0], 'role' => $users[$email][1]];
}
function current_user(): ?array { start_auth_session(); return $_SESSION['user'] ?? null; }
function require_auth(array $roles = []): array {
    $user = current_user();
    if (!$user) api_error('Authentication required.', 401);
    if ($roles && !in_array($user['role'] ?? '', $roles, true)) api_error('Insufficient permissions.', 403);
    return $user;
}
