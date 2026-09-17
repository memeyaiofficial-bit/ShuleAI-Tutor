-- Shule AI Plus PostgreSQL schema
-- Production-oriented schema for tutors, bookings, auth, and M-Pesa payment tracking.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tutors (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    whatsapp VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    tsc_number VARCHAR(100),
    id_number VARCHAR(100),
    county VARCHAR(120) NOT NULL,
    hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
    rating NUMERIC(3,2) NOT NULL DEFAULT 0,
    review_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    annual_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tutor_subjects (
    id SERIAL PRIMARY KEY,
    tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    subject_name VARCHAR(120) NOT NULL,
    UNIQUE (tutor_id, subject_name)
);

CREATE TABLE IF NOT EXISTS tutor_availability (
    id SERIAL PRIMARY KEY,
    tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    slot_label VARCHAR(30) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (tutor_id, day_of_week, slot_label)
);

CREATE TABLE IF NOT EXISTS tutor_holidays (
    id SERIAL PRIMARY KEY,
    tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    UNIQUE (tutor_id, holiday_date)
);

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    parent_name VARCHAR(255) NOT NULL,
    parent_whatsapp VARCHAR(50) NOT NULL,
    parent_email VARCHAR(255) NOT NULL,
    child_grade VARCHAR(80) NOT NULL,
    session_day VARCHAR(10) NOT NULL,
    session_slot VARCHAR(30) NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    phone_number VARCHAR(50) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    provider VARCHAR(50) NOT NULL DEFAULT 'MPESA',
    purpose VARCHAR(50) NOT NULL DEFAULT 'annual_fee',
    merchant_request_id VARCHAR(255),
    checkout_request_id VARCHAR(255),
    transaction_reference VARCHAR(255),
    mpesa_receipt_number VARCHAR(255),
    response_code VARCHAR(50),
    response_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tutors_county ON tutors(county);
CREATE INDEX IF NOT EXISTS idx_tutors_email ON tutors(email);
CREATE INDEX IF NOT EXISTS idx_tutor_subjects_subject ON tutor_subjects(subject_name);
CREATE INDEX IF NOT EXISTS idx_bookings_tutor ON bookings(tutor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_payments_tutor ON payments(tutor_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_reference);
