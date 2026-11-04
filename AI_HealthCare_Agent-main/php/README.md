# Carepoint PHP API

This is an incremental PHP API that runs beside the existing Node.js backend. `server.js` and the current frontend are intentionally preserved.

## Requirements

- PHP 8.1 or newer with `json`, `openssl`, and `session` enabled.
- MongoDB support: install the MongoDB PHP extension and the Composer library:

```text
pecl install mongodb
composer require mongodb/mongodb
```

The API detects `MongoDB\\Client` when the Composer package is available. Without it, development mode uses the existing `../db.json` file. The fallback is not suitable for production healthcare data.

## Run locally

From this directory, configure environment variables from `.env.example`, then run:

```text
php -S localhost:8000 index.php
```

Endpoints:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/patients` (doctor/staff)
- `GET /api/doctors` (authenticated users)
- `GET /api/staff` (staff only)
- `GET /api/chat?patientEmail=...&doctorEmail=...` (patient/doctor)
- `POST /api/chat` with `patientEmail`, `doctorEmail`, and `text` (patient/doctor)

The development demo credentials also include `admin@carepoint.demo` / `Admin123!`; administrator registration is disabled and administrative account management remains a server-side operation.

Requests and responses are JSON. Authentication uses secure PHP sessions. Passwords are stored only as `password_hash()` hashes, and sensitive endpoints require authentication and role authorization. Configure `CAREPOINT_CORS_ORIGIN` to the exact frontend origin; do not use `*` with credentials.

PHP-created users use native `password_hash()` credentials. The three documented demo accounts are recognized through precomputed hashes for compatibility with the existing Node seed; other existing Node scrypt hashes require a controlled server-side migration before switching authentication traffic to PHP.
