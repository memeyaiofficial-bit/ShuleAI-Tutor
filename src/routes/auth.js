const express = require('express');
const { query } = require('../db');
const { hashPassword, comparePassword, signTutor } = require('../auth');

const router = express.Router();

function sanitizeTutor(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    name: row.full_name,
    email: row.email,
    whatsapp: row.whatsapp,
    tscNumber: row.tsc_number,
    idNumber: row.id_number,
    county: row.county,
    hourlyRate: Number(row.hourly_rate),
    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || 0),
    isActive: row.is_active,
    annualFeePaid: row.annual_fee_paid,
    createdAt: row.created_at,
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      whatsapp,
      password,
      tscNumber,
      idNumber,
      county,
      hourlyRate,
      subjects = [],
    } = req.body;

    if (!fullName || !email || !whatsapp || !password || !county) {
      return res.status(400).json({ message: 'Name, email, Whatsapp, password, and county are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedWhatsapp = String(whatsapp).trim();

    const existing = await query(
      'SELECT id FROM tutors WHERE LOWER(email)=LOWER($1) OR whatsapp=$2 LIMIT 1',
      [normalizedEmail, normalizedWhatsapp]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'A tutor with that email or WhatsApp already exists.' });
    }

    const passwordHash = await hashPassword(password);

    const result = await query(
      `INSERT INTO tutors (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 5.0, 0, FALSE, FALSE, NOW(), NOW())
      RETURNING *`,
      [fullName.trim(), normalizedEmail, normalizedWhatsapp, passwordHash, tscNumber || null, idNumber || null, county, Number(hourlyRate || 0)]
    );

    const tutor = sanitizeTutor(result.rows[0]);
    const token = signTutor(result.rows[0]);

    if (Array.isArray(subjects) && subjects.length > 0) {
      const subjectParams = subjects.map((subject) => [result.rows[0].id, subject]);
      const placeholders = subjectParams.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(', ');
      const values = subjectParams.flat();
      await query(`INSERT INTO tutor_subjects (tutor_id, subject_name) VALUES ${placeholders}`, values);
    }

    res.status(201).json({ message: 'Tutor registered successfully.', token, tutor });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Email or WhatsApp and password are required.' });
    }

    const cleanIdentifier = String(identifier).trim();
    const result = await query(
      `SELECT * FROM tutors WHERE LOWER(email) = LOWER($1) OR whatsapp = $2 LIMIT 1`,
      [cleanIdentifier, cleanIdentifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid login credentials.' });
    }

    const tutor = result.rows[0];
    const valid = await comparePassword(password, tutor.password_hash);

    if (!valid) {
      return res.status(401).json({ message: 'Invalid login credentials.' });
    }

    if (!tutor.is_active) {
      return res.status(403).json({ message: 'Account pending payment confirmation. Complete the M-Pesa verification to activate your tutor account.' });
    }

    const token = signTutor(tutor);
    res.json({ message: 'Login successful.', token, tutor: sanitizeTutor(tutor) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
