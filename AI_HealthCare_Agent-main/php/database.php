<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
$autoload = __DIR__ . '/vendor/autoload.php';
if (is_file($autoload)) require_once $autoload;

function db_id(string $prefix): string { return $prefix . '_' . bin2hex(random_bytes(16)); }
function db_timestamp(): string { return gmdate('c'); }
function db_mode(): string { return class_exists('MongoDB\\Client') || class_exists('MongoClient') ? 'mongodb' : 'json'; }
function db_bootstrap(): void {
    if (!class_exists('MongoDB\\Client')) return;
    $client = new MongoDB\\Client(app_config()['mongo_uri']);
    $database = $client->selectDatabase(app_config()['database']);
    $indexes = [
        'users' => [['email' => 1], ['phone' => 1]],
        'patients' => [['patientId' => 1], ['userId' => 1]],
        'doctors' => [['doctorId' => 1], ['userId' => 1]],
        'staff' => [['staffId' => 1], ['userId' => 1]],
        'appointments' => [['appointmentId' => 1], ['patientId' => 1], ['doctorId' => 1]],
        'doctor_assignments' => [['appointmentId' => 1], ['doctorId' => 1]],
        'prescriptions' => [['patientId' => 1], ['doctorId' => 1]],
        'audit_logs' => [['actorUserId' => 1, 'createdAt' => -1]]
    ];
    foreach (PHP_COLLECTIONS as $collection) $database->selectCollection($collection)->createIndex(['id' => 1], ['unique' => true]);
    foreach ($indexes as $collection => $collectionIndexes) foreach ($collectionIndexes as $index) $database->selectCollection($collection)->createIndex($index);
}
function db_read_json(): array {
    static $database;
    if ($database !== null) return $database;
    $path = app_config()['json_path'];
    $database = is_file($path) ? json_decode(file_get_contents($path), true) : [];
    if (!is_array($database)) $database = [];
    foreach (PHP_COLLECTIONS as $collection) $database[$collection] ??= [];
    return $database;
}
function db_write_json(array $database): void {
    file_put_contents(app_config()['json_path'], json_encode($database, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL, LOCK_EX);
}
function db_ensure_role_profiles(): void {
    foreach (db_find('users') as $user) {
        $role = $user['role'] ?? '';
        if (!in_array($role, ['patient', 'doctor', 'staff'], true)) continue;
        $collection = $role . 's';
        $userId = $user['userId'] ?? $user['id'];
        if (db_find($collection, ['userId' => $userId])) continue;
        $profile = ['userId' => $userId, 'name' => $user['name'] ?? '', 'email' => $user['email'] ?? ''];
        $profile[$role . 'Id'] = db_id($role);
        if (isset($user['phone'])) $profile['phone'] = $user['phone'];
        db_insert($collection, $profile);
    }
}
function db_find(string $collection, array $filter = []): array {
    if (!in_array($collection, PHP_COLLECTIONS, true)) throw new InvalidArgumentException('Unsupported collection.');
    if (class_exists('MongoDB\\Client')) {
        $client = new MongoDB\\Client(app_config()['mongo_uri']);
        $documents = $client->selectCollection(app_config()['database'], $collection)->find($filter, ['projection' => ['_id' => 0]]);
        return array_map(static fn($document): array => is_object($document) ? json_decode(json_encode($document), true) : $document, iterator_to_array($documents, false));
    }
    $records = db_read_json()[$collection] ?? [];
    return array_values(array_filter($records, static fn(array $record): bool => count(array_filter($filter, static fn($value, $key): bool => ($record[$key] ?? null) !== $value, ARRAY_FILTER_USE_BOTH)) === 0));
}
function db_insert(string $collection, array $record): array {
    if (!in_array($collection, PHP_COLLECTIONS, true)) throw new InvalidArgumentException('Unsupported collection.');
    $timestamp = db_timestamp();
    $record['id'] ??= db_id($collection);
    $record['createdAt'] ??= $timestamp;
    $record['updatedAt'] = $timestamp;
    if (class_exists('MongoDB\\Client')) {
        $client = new MongoDB\\Client(app_config()['mongo_uri']);
        $client->selectCollection(app_config()['database'], $collection)->insertOne($record);
        return $record;
    }
    $database = db_read_json();
    $database[$collection][] = $record;
    db_write_json($database);
    return $record;
}
