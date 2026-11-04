<?php
declare(strict_types=1);

function api_response(int $status, array $body): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}
function api_success(mixed $data, int $status = 200): never { api_response($status, ['data' => $data]); }
function api_error(string $message, int $status = 400): never { api_response($status, ['error' => $message]); }
function log_api_error(Throwable $error): void {
    $path = app_config()['log_path'];
    $directory = dirname($path);
    if (!is_dir($directory)) mkdir($directory, 0750, true);
    error_log(sprintf("[%s] %s\n", date(DATE_ATOM), $error->getMessage()), 3, $path);
}
function json_input(): array {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($body)) api_error('Request body must be a JSON object.', 400);
    return $body;
}
