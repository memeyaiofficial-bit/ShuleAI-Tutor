const express = require('express');
const { pool, query } = require('../db');

const router = express.Router();
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_LABELS = ['6–8am', '8–10am', '10am–12pm', '2–4pm', '4–6pm', '6–8pm'];

function normalizeAvailability(rows) {
  const days = {};
  DAY_NAMES.forEach((day) => {
    days[day] = Array(SLOT_LABELS.length).fill(false);
  });

  rows.forEach((row) => {
    if (DAY_NAMES[row.day_of_week]) {
      const day = DAY_NAMES[row.day_of_week];
      const normalizedSlot = String(row.slot_label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const slotIndex = SLOT_LABELS.findIndex((slot) =>
        slot.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSlot
      );
      if (slotIndex >= 0) {
        days[day][slotIndex] = row.is_available;
      }
    }
  });

  return days;
}

router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        t.id,
        t.full_name AS name,
        t.email,
        t.whatsapp,
        t.tsc_number AS tsc,
        t.id_number AS idnum,
        t.county,
        t.hourly_rate AS rate,
        t.rating,
        t.review_count AS reviews,
        COALESCE(ARRAY_AGG(DISTINCT ts.subject_name) FILTER (WHERE ts.subject_name IS NOT NULL), ARRAY[]::text[]) AS subjects,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'day_of_week', ta.day_of_week,
          'slot_label', ta.slot_label,
          'is_available', ta.is_available
        )) FILTER (WHERE ta.id IS NOT NULL), '[]'::json) AS availability_rows,
        COALESCE(json_agg(DISTINCT th.holiday_date) FILTER (WHERE th.id IS NOT NULL), '[]'::json) AS holidays
      FROM tutors t
      LEFT JOIN tutor_subjects ts ON ts.tutor_id = t.id
      LEFT JOIN tutor_availability ta ON ta.tutor_id = t.id
      LEFT JOIN tutor_holidays th ON th.tutor_id = t.id
      WHERE t.is_active = TRUE
      GROUP BY t.id
      ORDER BY t.rating DESC NULLS LAST, t.id ASC
    `);

    const tutors = result.rows.map((row) => {
      const availabilityRows = Array.isArray(row.availability_rows) ? row.availability_rows : [];
      const availability = normalizeAvailability(availabilityRows.map((item) => ({
        day_of_week: Number(item.day_of_week),
        slot_label: item.slot_label,
        is_available: Boolean(item.is_available),
      })));

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        whatsapp: row.whatsapp,
        tsc: row.tsc,
        idnum: row.idnum,
        county: row.county,
        rate: Number(row.rate),
        rating: Number(row.rating || 0),
        reviews: Number(row.reviews || 0),
        subjects: row.subjects || [],
        availability,
        holidays: Array.isArray(row.holidays) ? row.holidays : [],
      };
    });

    res.json(tutors);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT
        t.id,
        t.full_name AS name,
        t.email,
        t.whatsapp,
        t.tsc_number AS tsc,
        t.id_number AS idnum,
        t.county,
        t.hourly_rate AS rate,
        t.rating,
        t.review_count AS reviews,
        COALESCE(ARRAY_AGG(DISTINCT ts.subject_name) FILTER (WHERE ts.subject_name IS NOT NULL), ARRAY[]::text[]) AS subjects,
        COALESCE(json_agg(DISTINCT jsonb_build_object(
          'day_of_week', ta.day_of_week,
          'slot_label', ta.slot_label,
          'is_available', ta.is_available
        )) FILTER (WHERE ta.id IS NOT NULL), '[]'::json) AS availability_rows,
        COALESCE(json_agg(DISTINCT th.holiday_date) FILTER (WHERE th.id IS NOT NULL), '[]'::json) AS holidays
      FROM tutors t
      LEFT JOIN tutor_subjects ts ON ts.tutor_id = t.id
      LEFT JOIN tutor_availability ta ON ta.tutor_id = t.id
      LEFT JOIN tutor_holidays th ON th.tutor_id = t.id
      WHERE t.id = $1 AND t.is_active = TRUE
      GROUP BY t.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    const row = result.rows[0];
    const availabilityRows = Array.isArray(row.availability_rows) ? row.availability_rows : [];
    const tutor = {
      id: row.id,
      name: row.name,
      email: row.email,
      whatsapp: row.whatsapp,
      tsc: row.tsc,
      idnum: row.idnum,
      county: row.county,
      rate: Number(row.rate),
      rating: Number(row.rating || 0),
      reviews: Number(row.reviews || 0),
      subjects: row.subjects || [],
      availability: normalizeAvailability(availabilityRows.map((item) => ({
        day_of_week: Number(item.day_of_week),
        slot_label: item.slot_label,
        is_available: Boolean(item.is_available),
      }))),
      holidays: Array.isArray(row.holidays) ? row.holidays : [],
    };

    res.json(tutor);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE tutors
       SET is_active = FALSE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, full_name` ,
      [Number(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tutor not found.' });
    }

    res.json({ message: 'Tutor removed successfully', tutor: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const {
    fullName,
    email,
    whatsapp,
    tscNumber,
    idNumber,
    county,
    hourlyRate,
    subjects = [],
    availability = {},
    holidays = [],
  } = req.body;

  if (!fullName || !email || !whatsapp || !county) {
    return res.status(400).json({ message: 'Missing required tutor details.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedWhatsapp = String(whatsapp).trim();

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check for existing tutor (including soft-deleted) with same email or WhatsApp
    const existing = await client.query(
      'SELECT id, is_active FROM tutors WHERE LOWER(email) = LOWER($1) OR whatsapp = $2 LIMIT 1',
      [normalizedEmail, normalizedWhatsapp]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: 'A tutor with this email or WhatsApp already exists (possibly deactivated).',
      });
    }

    const insertTutor = await client.query(
      `INSERT INTO tutors (
        full_name,
        email,
        whatsapp,
        tsc_number,
        id_number,
        county,
        hourly_rate,
        password_hash,
        rating,
        review_count,
        is_active,
        annual_fee_paid,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 5.0, 0, FALSE, FALSE, NOW(), NOW()) RETURNING *`,
      [fullName, normalizedEmail, normalizedWhatsapp, tscNumber || null, idNumber || null, county, Number(hourlyRate || 0), '']
    );

    const tutorId = insertTutor.rows[0].id;

    if (Array.isArray(subjects) && subjects.length > 0) {
      const subjectValues = subjects.flatMap((subject) => [tutorId, subject]);
      const placeholders = subjects.map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`).join(', ');
      await client.query(
        `INSERT INTO tutor_subjects (tutor_id, subject_name) VALUES ${placeholders}`,
        subjectValues
      );
    }

    const dayEntries = [];
    for (const [day, slots] of Object.entries(availability)) {
      const dayIndex = DAY_NAMES.indexOf(day);
      if (dayIndex === -1) continue;
      slots.forEach((isAvailable, index) => {
        if (isAvailable) {
          dayEntries.push([tutorId, dayIndex, SLOT_LABELS[index], true]);
        }
      });
    }

    if (dayEntries.length > 0) {
      const params = [];
      const placeholders = dayEntries.map((entry, index) => {
        const base = index * 4;
        params.push(entry[0], entry[1], entry[2], entry[3]);
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      }).join(', ');
      await client.query(
        `INSERT INTO tutor_availability (tutor_id, day_of_week, slot_label, is_available) VALUES ${placeholders}`,
        params
      );
    }

    if (Array.isArray(holidays) && holidays.length > 0) {
      const holidayParams = [];
      const holidayPlaceholders = holidays.map((date, index) => {
        holidayParams.push(tutorId, date);
        return `($${index * 2 + 1}, $${index * 2 + 2})`;
      }).join(', ');
      await client.query(
        `INSERT INTO tutor_holidays (tutor_id, holiday_date) VALUES ${holidayPlaceholders}`,
        holidayParams
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Tutor created successfully', id: tutorId });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      // Unique violation on tutors_email_key
      return res.status(409).json({ message: 'A tutor with this email already exists.' });
    }
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
