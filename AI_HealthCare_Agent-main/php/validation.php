<?php
declare(strict_types=1);

function required_string(array $input, string $key, int $max = 255): string {
    $value = trim((string)($input[$key] ?? ''));
    if ($value === '' || strlen($value) > $max) api_error("Invalid {$key}.", 422);
    return $value;
}
function valid_role(string $role): string {
    if (!in_array($role, ['patient', 'doctor', 'staff', 'admin'], true)) api_error('Invalid role.', 422);
    return $role;
}
function email_value(array $input): string {
    $email = strtolower(required_string($input, 'email', 320));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) api_error('Invalid email.', 422);
    return $email;
}
