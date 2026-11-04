<?php
declare(strict_types=1);

function env_value(string $key, ?string $default = null): ?string {
    $value = getenv($key);
    return $value === false || $value === '' ? $default : $value;
}

const PHP_COLLECTIONS = [
    'users', 'patients', 'doctors', 'staff', 'appointments', 'medical_reports',
    'laboratory_reports', 'prescriptions', 'medicines', 'referrals', 'departments',
    'doctor_availability', 'doctor_leave', 'doctor_assignments', 'followups', 'notifications',
    'memberships', 'chatbot_conversations', 'ai_recommendations', 'messages', 'audit_logs'
];

function app_config(): array {
    return [
        'database' => env_value('CAREPOINT_DB_NAME', 'carepoint'),
        'mongo_uri' => env_value('MONGODB_URI', 'mongodb://localhost:27017/'),
        'json_path' => env_value('CAREPOINT_JSON_PATH', dirname(__DIR__) . DIRECTORY_SEPARATOR . 'db.json'),
        'cors_origin' => env_value('CAREPOINT_CORS_ORIGIN', 'http://localhost:3000'),
        'session_name' => env_value('CAREPOINT_SESSION_NAME', 'carepoint_php_session'),
        'log_path' => env_value('CAREPOINT_LOG_PATH', __DIR__ . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'api.log')
    ];
}
