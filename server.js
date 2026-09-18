require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const tutorsRouter = require('./src/routes/tutors');
const bookingsRouter = require('./src/routes/bookings');
const authRouter = require('./src/routes/auth');
const paymentsRouter = require('./src/routes/payments');
const { testConnection } = require('./src/db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res) => {
  try {
    const timestamp = await testConnection();
    res.json({
      status: 'ok',
      message: 'Shule AI Plus API is running',
      database: process.env.DATABASE_URL ? 'configured' : 'default-local',
      time: timestamp,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/tutors', tutorsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/admin', express.static(path.join(__dirname, 'Admin')));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong', error: err.message });
});

app.listen(PORT, () => {
  console.log(`Shule AI Plus API running on port ${PORT}`);
});
