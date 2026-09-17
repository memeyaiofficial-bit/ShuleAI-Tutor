-- Seed data for local development and demonstration.
-- This file is intentionally realistic but can be expanded later.

INSERT INTO tutors (
  full_name,
  email,
  whatsapp,
  password_hash,
  tsc_number,
  id_number,
  county,
  hourly_rate,
  rating,
  review_count,
  is_active,
  annual_fee_paid,
  created_at,
  updated_at
) VALUES
  ('Jane Wanjiru', 'jane.wanjiru@example.com', '+254712345001', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '445210', '22013344', 'Nairobi', 900, 4.9, 132, TRUE, TRUE, NOW(), NOW()),
  ('David Mutua', 'david.mutua@example.com', '+254712345002', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '778102', '27551190', 'Machakos', 750, 4.8, 98, TRUE, TRUE, NOW(), NOW()),
  ('Faith Otieno', 'faith.otieno@example.com', '+254712345003', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '519873', '25889210', 'Kisumu', 650, 5.0, 76, TRUE, TRUE, NOW(), NOW()),
  ('Grace Achieng', 'grace.achieng@example.com', '+254712345004', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '602198', '29104477', 'Nairobi', 800, 4.7, 154, TRUE, TRUE, NOW(), NOW()),
  ('Peter Mungai', 'peter.mungai@example.com', '+254712345005', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '201884', '33208511', 'Kiambu', 950, 4.9, 118, TRUE, TRUE, NOW(), NOW()),
  ('Lucy Njeri', 'lucy.njeri@example.com', '+254712345006', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '991042', '27019883', 'Nakuru', 700, 4.6, 91, TRUE, TRUE, NOW(), NOW()),
  ('Samuel Kariuki', 'samuel.kariuki@example.com', '+254712345007', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '772301', '29940125', 'Nyeri', 850, 4.8, 109, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

INSERT INTO tutor_subjects (tutor_id, subject_name)
SELECT t.id, v.subject_name
FROM (
  VALUES
    ('jane.wanjiru@example.com', 'Mathematics'),
    ('jane.wanjiru@example.com', 'Physics'),
    ('david.mutua@example.com', 'Chemistry'),
    ('david.mutua@example.com', 'Biology'),
    ('faith.otieno@example.com', 'Kiswahili'),
    ('grace.achieng@example.com', 'English'),
    ('grace.achieng@example.com', 'Social Studies'),
    ('peter.mungai@example.com', 'Mathematics'),
    ('peter.mungai@example.com', 'Computer Science'),
    ('lucy.njeri@example.com', 'English'),
    ('lucy.njeri@example.com', 'Creative Arts'),
    ('samuel.kariuki@example.com', 'Biology'),
    ('samuel.kariuki@example.com', 'Chemistry')
) AS v(email, subject_name)
JOIN tutors t ON t.email = v.email
ON CONFLICT (tutor_id, subject_name) DO NOTHING;

INSERT INTO bookings (
  tutor_id,
  parent_name,
  parent_whatsapp,
  parent_email,
  child_grade,
  session_day,
  session_slot,
  amount,
  status,
  created_at
)
SELECT
  t.id,
  v.parent_name,
  v.parent_whatsapp,
  v.parent_email,
  v.child_grade,
  v.session_day,
  v.session_slot,
  v.amount,
  v.status,
  NOW()
FROM (
  VALUES
    ('jane.wanjiru@example.com', 'Susan Kamau', '+254722000111', 'susan.kamau@example.com', 'Grade 6', 'Sat', '6–8am', 900, 'Confirmed'),
    ('jane.wanjiru@example.com', 'Brian Otieno', '+254722000222', 'brian.otieno@example.com', 'Grade 4', 'Wed', '2–4pm', 900, 'Confirmed'),
    ('faith.otieno@example.com', 'Alice Wambui', '+254722000333', 'alice.wambui@example.com', 'Grade 8', 'Mon', '6–8am', 650, 'Confirmed'),
    ('peter.mungai@example.com', 'Esther Gacheri', '+254722000444', 'esther.gacheri@example.com', 'Grade 7', 'Thu', '4–6pm', 950, 'Confirmed'),
    ('lucy.njeri@example.com', 'Daniel Kibet', '+254722000555', 'daniel.kibet@example.com', 'Grade 5', 'Fri', '10am–12pm', 700, 'Confirmed'),
    ('samuel.kariuki@example.com', 'Mercy Wanjiku', '+254722000666', 'mercy.wanjiku@example.com', 'Form 2', 'Sun', '6–8pm', 850, 'Confirmed')
) AS v(email, parent_name, parent_whatsapp, parent_email, child_grade, session_day, session_slot, amount, status)
JOIN tutors t ON t.email = v.email
WHERE NOT EXISTS (
  SELECT 1
  FROM bookings b
  WHERE b.tutor_id = t.id
    AND b.parent_email = v.parent_email
    AND b.child_grade = v.child_grade
);

INSERT INTO payments (
  tutor_id,
  booking_id,
  phone_number,
  amount,
  currency,
  status,
  provider,
  purpose,
  transaction_reference,
  merchant_request_id,
  checkout_request_id,
  response_code,
  response_description,
  mpesa_receipt_number,
  created_at,
  updated_at
)
SELECT
  t.id,
  b.id,
  v.phone_number,
  v.amount,
  v.currency,
  v.status,
  v.provider,
  v.purpose,
  v.transaction_reference,
  v.merchant_request_id,
  v.checkout_request_id,
  v.response_code,
  v.response_description,
  v.mpesa_receipt_number,
  NOW(),
  NOW()
FROM (
  VALUES
    ('jane.wanjiru@example.com', 'susan.kamau@example.com', '+254712345001', 900, 'KES', 'PAID', 'MPESA', 'annual_fee', 'TX-001', 'MR-001', 'CR-001', '0', 'Payment successful', 'ABC123XYZ'),
    ('faith.otieno@example.com', 'alice.wambui@example.com', '+254712345003', 650, 'KES', 'PAID', 'MPESA', 'booking_payment', 'TX-002', 'MR-002', 'CR-002', '0', 'Payment successful', 'DEF456XYZ'),
    ('peter.mungai@example.com', 'esther.gacheri@example.com', '+254712345005', 950, 'KES', 'PAID', 'MPESA', 'booking_payment', 'TX-003', 'MR-003', 'CR-003', '0', 'Payment successful', 'GHI789XYZ'),
    ('lucy.njeri@example.com', 'daniel.kibet@example.com', '+254712345006', 700, 'KES', 'PAID', 'MPESA', 'booking_payment', 'TX-004', 'MR-004', 'CR-004', '0', 'Payment successful', 'JKL012XYZ')
) AS v(email, parent_email, phone_number, amount, currency, status, provider, purpose, transaction_reference, merchant_request_id, checkout_request_id, response_code, response_description, mpesa_receipt_number)
JOIN tutors t ON t.email = v.email
LEFT JOIN bookings b ON b.tutor_id = t.id AND b.parent_email = v.parent_email
WHERE NOT EXISTS (
  SELECT 1
  FROM payments p
  WHERE p.transaction_reference = v.transaction_reference
);
