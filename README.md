# Shule AI Plus

Shule AI Plus is a demo-ready tutor marketplace for parents and tutors in Kenya. Parents can browse verified tutors, filter by subject and county, book a session, and pay with M-Pesa. Tutors can register, log in, view their bookings, and manage their profile.

## Product overview

- Parent-facing marketplace with subject and county filters
- Tutor onboarding with KYC details, subject tags, and weekly availability
- Booking flow with session selection and payment prompt
- Tutor dashboard for upcoming booking history
- PostgreSQL-backed data layer for a Render deployment setup
- M-Pesa STK-ready payment route with deployment-safe env configuration

## Tech stack

- Front-end: static HTML, CSS, and vanilla JavaScript
- Back-end: Node.js + Express
- Database: PostgreSQL 17
- Auth: JWT + bcrypt
- Payments: M-Pesa STK integration ready for Daraja env keys

## Project structure

- `index.html` — full marketplace UI and browser-side integration
- `server.js` — Express app bootstrap and route mounting
- `src/` — database helper, auth helpers, and route logic
- `database/schema.sql` — PostgreSQL schema
- `database/seed.sql` — demo tutors, subjects, and bookings
- `.env` — local environment values
- `.env.example` — template for deployment and local setup
- `render.yaml` — Render deployment configuration

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Make sure PostgreSQL is running locally.

3. Create a local database named `shule_tutor`.

4. Copy the example env file and update it if needed:

```bash
cp .env.example .env
```

5. Initialize the schema and demo data:

```bash
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -p 6543 -U postgres -d shule_tutor -f database\schema.sql
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -p 6543 -U postgres -d shule_tutor -f database\seed.sql
```

6. Start the API:

```bash
npm start
```

7. Open the front end in a browser:

```text
file:///C:/Users/Anthony%20Designs/Desktop/ShuleTutor/index.html
```

## Demo credentials

Seeded tutor login example:

- Email: `jane.wanjiru@example.com`
- Password: `password`

## API endpoints

- `GET /api/health`
- `GET /api/tutors`
- `GET /api/tutors/:id`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/bookings`
- `POST /api/bookings`
- `POST /api/payments/mpesa/initiate`
- `POST /api/payments/mpesa/callback`

## Render deployment

This project is structured for Render deployment using `render.yaml`.

### Required Render environment variables

- `NODE_ENV=production`
- `PORT=10000`
- `DATABASE_URL` — auto-provided from the Render Postgres service
- `JWT_SECRET` — generate a secure secret
- `MPESA_ENVIRONMENT=production`
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL`
- `MPESA_TRANSACTION_PREFIX=SHULE`

When the real Daraja credentials are added, the STK flow can go live without changing the app code.

## Demo notes

This app is intentionally polished for demo and proof-of-concept use. The data and flows are designed to feel realistic while remaining safe for local development and future production deployment.

## License

MIT
