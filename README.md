<div align="center">
<pre>
█████╗      █████╗
██╔══██╗    ██╔══██╗
███████║    ╚█████╔╝
██╔══██║    ██╔══██╗
██║  ██║    ╚█████╔╝
╚═╝  ╚═╝     ╚════╝
</pre>
</div>

[![npm version](https://img.shields.io/npm/v/create-authenik8-app?label=create-authenik8-app)](https://www.npmjs.com/package/create-authenik8-app)
[![Maintained](https://img.shields.io/github/last-commit/COD434/Authenik8/main?label=maintained)](https://github.com/COD434/Authenik8/commits/main)
[![CI](https://github.com/COD434/Authenik8/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/COD434/Authenik8/actions/workflows/ci.yml)
![Documents Passing](https://img.shields.io/badge/documents-passing-brightgreen)
![Security Tests](https://img.shields.io/badge/security%20tests-passing-brightgreen)

[Create a new Authenik8 project with `create-authenik8-app`](https://github.com/COD434/create-authenik8-app)

<div align="center">
<h1>Authenik8</h1>
</div>

Authenik8 is a secure authentication and rate-limiting API for modern web apps.
It gives developers a ready-to-run backend for registration, login, JWT sessions,
refresh tokens, password reset OTPs, email verification, guest-mode auth, admin
controls, IP whitelisting, and Prometheus metrics.

The API is built with TypeScript, Node.js, Express, Prisma, PostgreSQL, Redis,
RabbitMQ, Docker, Swagger, Prometheus, and Grafana.

## What It Does

Authenik8 handles the authentication infrastructure most apps need before they
can safely launch:

- User registration with password hashing
- Email verification using OTP-style verification tokens
- Login with JWT access tokens
- Refresh-token storage backed by Redis
- Password reset requests, OTP verification, and password updates
- Redis-backed token bucket rate limiting for login and OTP routes
- Anonymous guest-mode authentication
- Role-based admin access
- Dynamic IP whitelist management for admin-controlled access
- Security headers through Helmet
- API metrics through Prometheus
- Grafana-ready observability setup
- Docker Compose setup for API, PostgreSQL, Redis, RabbitMQ, Prometheus, and Grafana
- Swagger API documentation endpoint

## Why Developers Should Use It

Authentication is easy to underestimate. A production app usually needs more
than a login endpoint: it needs secure password handling, token expiry, reset
flows, abuse protection, admin permissions, email delivery, monitoring, and a
deployment story.

Authenik8 gives you those pieces in one API so you can focus on your product
instead of rebuilding auth from scratch.

Use Authenik8 when you want:

- A standalone auth API for a React, Next.js, Vue, mobile, or backend app
- JWT-based auth without writing the full auth flow yourself
- Built-in rate limiting for login and OTP abuse prevention
- Redis-backed session and refresh-token handling
- Email verification and password reset flows
- Admin-only routes and IP whitelist controls
- Metrics you can plug into Prometheus and Grafana
- A Docker-based local and deployment workflow

## Tech Stack

- Runtime: Node.js 22
- Language: TypeScript
- API framework: Express
- Database: PostgreSQL
- ORM: Prisma
- Cache/session/rate-limit store: Redis
- Queue: RabbitMQ
- Email providers supported in code: SendGrid, Nodemailer, Mailgun-compatible setup
- Metrics: Prometheus via `prom-client`
- Dashboards: Grafana-ready
- Docs: Swagger UI
- Tests: Mocha, Chai, Supertest, Sinon

## API Overview

### Public Auth Routes

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/register` | Register a new user and send a verification token |
| `POST` | `/login` | Authenticate a user and return access and refresh tokens |
| `POST` | `/request-password-reset` | Send a password reset OTP |
| `POST` | `/verify-reset-otp` | Verify a password reset OTP |
| `POST` | `/update-password` | Update a user's password after OTP verification |
| `GET` | `/api/auth/verify-email?token=...` | Verify a user's email address |
| `GET` | `/api/auth/guest-mode` | Create or validate guest-mode access |
| `POST` | `/api/auth/logout` | Clear the auth cookie |

### Admin Routes

Admin routes require a valid admin JWT.

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/admin/refresh-token` | Refresh an admin token |
| `POST` | `/api/auth/admin/whitelist/add` | Add an IP or CIDR range to the whitelist |
| `POST` | `/api/auth/admin/whitelist/remove` | Remove an IP or CIDR range from the whitelist |
| `GET` | `/api/auth/admin/whitelist/list` | List whitelisted IPs |

### Observability and Docs

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/metrics` | Prometheus metrics endpoint |
| `GET` | `/api-docs` | Swagger UI documentation |

## Quick Start With Docker

Clone the project:

```bash
git clone https://github.com/COD434/Authenik8
cd Authenik8
```

Create your environment file:

```bash
cp .env.example .env
```

If this repo does not include `.env.example` yet, create `.env` manually using
the variables in the Environment Variables section below.

Start the full stack:

```bash
docker compose up --build
```

The Docker Compose setup starts:

- Authenik8 API
- PostgreSQL
- Redis
- RabbitMQ
- Email worker
- Prometheus
- Grafana

## Local Development

Install dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate deploy
```

Start the development server:

```bash
npm run devStart
```

Build the project:

```bash
npm run build
```

Start the compiled API:

```bash
npm start
```

Run tests:

```bash
npm test
```

## Environment Variables

Authenik8 expects these values in your environment:

```bash
NODE_ENV=development
PORT=5000

DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE_NAME

REDIS_HOST=localhost
REDIS_PORT=6379

RABBITMQ_URL=amqp://localhost

JWT_SECRET=replace-with-a-strong-secret
JWT_REFRESH_SECRET=replace-with-a-different-strong-secret

ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
PASS=replace-with-a-strong-admin-password

BASE_URL=http://localhost:5000
RESET_EMAIL_USER=no-reply@example.com

SENDGRID_API_KEY=optional-sendgrid-key
MAILGUN_API_KEY=optional-mailgun-key
MAILGUN_DOMAIN=optional-mailgun-domain
EMAIL_FROM=no-reply@example.com
```

Use strong secrets in production. Do not commit real credentials. The current admin seeder reads the admin password from `PASS`.

## Example Usage

### Register

```bash
curl -X POST http://localhost:5000/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo_user",
    "email": "demo@example.com",
    "password": "StrongPass123!"
  }'
```

### Login

```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "StrongPass123!"
  }'
```

Successful login returns user details, an access token, and a refresh token.
Protected routes should send the access token as a bearer token:

```bash
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Request Password Reset

```bash
curl -X POST http://localhost:5000/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{ "email": "demo@example.com" }'
```

### Verify Reset OTP

```bash
curl -X POST http://localhost:5000/verify-reset-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "otp": "123456"
  }'
```

### Update Password

```bash
curl -X POST http://localhost:5000/update-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "NewStrongPass123!"
  }'
```

### Guest Mode

```bash
curl -i http://localhost:5000/api/auth/guest-mode
```

If no valid token is provided, Authenik8 creates a guest token and returns it in
the `X-Guest-Token` response header.

## Using Authenik8 From a Frontend

For a frontend app, keep Authenik8 running as your auth service and call it from
your client or backend-for-frontend.

Basic flow:

1. Send new users to `/register`.
2. Ask users to verify their email with `/api/auth/verify-email?token=...`.
3. Login through `/login`.
4. Store the returned access token according to your app's security model.
5. Send `Authorization: Bearer <token>` on protected API requests.
6. Use the password reset endpoints when users forget their password.

## NPM Package Status

Authenik8 is being prepared for npm publishing.

The first npm release should make it easier to install the API tooling into a
project, but the current repo is already usable as a standalone authentication
service through GitHub clone, Docker, or direct Node.js execution.

Planned npm install flow:

```bash
npm install authenik8-api
```

Until the package is published, use:

```bash
git clone https://github.com/COD434/Authenik8
```

## Troubleshooting

### `docker compose up` fails because a port is already in use

Another local service is using one of the required ports.

Common ports:

- API: `5000`
- PostgreSQL: `5432`
- Redis: `6379`
- RabbitMQ: `5672` and `15672`
- Prometheus: `9090`
- Grafana: `3001`

Stop the conflicting service or update the port mapping in `docker-compose.yml`.

### Prisma cannot connect to the database

Check that PostgreSQL is running and that `DATABASE_URL` points to the correct
host, port, username, password, and database name.

For Docker Compose, the database host should usually be:

```bash
db
```

For local development outside Docker, it is usually:

```bash
localhost
```

Then run:

```bash
npx prisma generate
npx prisma migrate deploy
```

### Redis connection errors

Make sure Redis is running and your Redis environment variables are correct:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

Inside Docker Compose, the Redis host should usually be:

```bash
redis
```

### RabbitMQ email queue is not working

Make sure RabbitMQ is running and `RABBITMQ_URL` is correct:

```bash
RABBITMQ_URL=amqp://localhost
```

Inside Docker Compose, use:

```bash
RABBITMQ_URL=amqp://rabbitmq
```

You can inspect RabbitMQ locally at:

```text
http://localhost:15672
```

### Login returns invalid credentials

Confirm that:

- The user exists in the database
- The password matches the registered password
- The stored password is a bcrypt hash
- The request body includes `email` and `password`

Example:

```json
{
  "email": "demo@example.com",
  "password": "StrongPass123!"
}
```

### Registration fails validation

Passwords must be strong. Use a password with uppercase letters, lowercase
letters, numbers, and symbols.

Example:

```text
StrongPass123!
```

### Password reset OTP fails

Check that:

- The email belongs to an existing user
- The OTP has not expired
- The OTP being submitted matches the latest reset token
- The email worker and RabbitMQ queue are running

### `/metrics` is empty or missing expected counters

Metrics are created as requests hit the API. Exercise routes such as `/login`,
`/request-password-reset`, or `/api/auth/guest-mode`, then visit:

```text
http://localhost:5000/metrics
```

### Swagger docs are not showing routes

Open:

```text
http://localhost:5000/api-docs
```

If routes are missing, check the Swagger config and ensure the `apis` paths point
to the compiled or source files being used in your environment.

### Tests fail on database setup

Make sure PostgreSQL, Redis, and RabbitMQ are running before tests execute.
The CI workflow starts these services automatically, but local test runs need
matching services and a valid test `DATABASE_URL`.

Run:

```bash
npm test
```

## Production Notes

Before using Authenik8 in production:

- Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET` values
- Use production database credentials
- Use a managed Redis instance or properly secured Redis deployment
- Use HTTPS
- Set `NODE_ENV=production`
- Configure a real email provider
- Review CORS, cookie, and token storage rules for your frontend
- Keep secrets out of git
- Run migrations before starting the API
- Monitor `/metrics` with Prometheus and Grafana

## Contributing

Pull requests and discussions are welcome. Please open an issue first to discuss
major changes.

## Author

Built by TheSBD.

GitHub: [COD434](https://github.com/COD434)

Contact: seeisakarabo2@gmail.com
