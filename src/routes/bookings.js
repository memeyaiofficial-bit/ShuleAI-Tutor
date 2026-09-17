const express = require('express');
const { query } = require('../db');

const router = express.Router();

function buildTutorBookingMessage({ tutorName, parentName, parentWhatsapp, childGrade, day, slot, county }) {
  const locationText = county ? ` from ${county}` : '';
  return `Hi ${tutorName}, ${parentName}${locationText} has booked a tutoring session with you for ${childGrade} on ${day} at ${slot}. Please contact ${parentName} on ${parentWhatsapp} to confirm the lesson.`;
}

router.get('/', async (req, res, next) => {
  try {
    const { teacherId } = req.query;
    let sql = `
      SELECT *
      FROM bookings
    `;
    const params = [];

    if (teacherId) {
      sql += ' WHERE tutor_id = $1';
      params.push(Number(teacherId));
    }

    sql += ' ORDER BY created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      tutorId,
      parentName,
      parentWhatsapp,
      parentEmail,
      childGrade,
      day,
      slot,
      amount,
      status = 'Confirmed',
    } = req.body;

    if (!tutorId || !parentName || !parentWhatsapp || !parentEmail || !day || !slot) {
      return res.status(400).json({ message: 'Missing booking information.' });
    }

    const result = await query(
      `INSERT INTO bookings (
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *`,
      [Number(tutorId), parentName, parentWhatsapp, parentEmail, childGrade, day, slot, Number(amount || 0), status]
    );

    const tutorResult = await query(
      `SELECT full_name, county, whatsapp FROM tutors WHERE id = $1 LIMIT 1`,
      [Number(tutorId)]
    );

    const tutor = tutorResult.rows[0] || {};
    const tutorMessage = buildTutorBookingMessage({
      tutorName: tutor.full_name || 'Tutor',
      parentName,
      parentWhatsapp,
      childGrade,
      day,
      slot,
      county: tutor.county,
    });

    res.status(201).json({
      booking: result.rows[0],
      tutorMessage,
      tutorWhatsapp: tutor.whatsapp || null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
