const express = require('express');
const { query } = require('../db');
const { authRequired } = require('../auth');

const router = express.Router();

function getDarajaBaseUrl() {
  const env = (process.env.MPESA_ENVIRONMENT || 'sandbox').toLowerCase();
  return env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}

function hasDarajaConfig() {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_PASSKEY
  );
}

async function getDarajaAccessToken() {
  if (!hasDarajaConfig()) {
    return null;
  }

  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const response = await fetch(`${getDarajaBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Daraja auth failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

router.get('/', authRequired, async (req, res, next) => {
  try {
    const { tutorId } = req.query;
    const userId = Number(req.user.sub);
    const sql = tutorId
      ? 'SELECT * FROM payments WHERE tutor_id = $1 AND tutor_id = $2 ORDER BY created_at DESC'
      : 'SELECT * FROM payments WHERE tutor_id = $1 ORDER BY created_at DESC';
    const params = tutorId ? [Number(tutorId), userId] : [userId];
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get('/status', authRequired, async (req, res, next) => {
  try {
    const tutorId = Number(req.user.sub);
    const result = await query(
      `SELECT * FROM payments WHERE tutor_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [tutorId]
    );

    const payment = result.rows[0] || null;
    const normalizedStatus = payment ? String(payment.status || '').toUpperCase() : 'PENDING';
    const responseCode = payment && payment.response_code ? String(payment.response_code) : null;
    const cancelledCodes = ['1032', '1037', '1038', '1041'];
    const isCancelled = normalizedStatus === 'CANCELLED' || cancelledCodes.includes(responseCode);
    const isPaid = normalizedStatus === 'PAID';
    const isFailed = normalizedStatus === 'FAILED' || (!isPaid && !isCancelled && responseCode && responseCode !== '0' && responseCode !== '200');

    console.log('[MPESA STATUS]', {
      tutorId,
      paymentId: payment ? payment.id : null,
      status: payment ? payment.status : 'PENDING',
      normalizedStatus,
      responseCode,
      isPaid,
      isCancelled,
      isFailed,
      updatedAt: payment ? payment.updated_at : null,
    });

    if ((isCancelled || isFailed) && payment && payment.tutor_id) {
      const updated = await query(
        `UPDATE tutors
         SET is_active = FALSE,
             annual_fee_paid = FALSE,
             updated_at = NOW()
         WHERE id = $1 AND is_active = FALSE
         RETURNING id`,
        [payment.tutor_id]
      );
      payment.pendingTutorMarkedInactive = updated.rows.length > 0;
    }

    res.json({
      payment,
      status: payment ? payment.status : 'PENDING',
      normalizedStatus,
      responseCode,
      isPaid,
      isCancelled,
      isFailed,
      annualFeePaid: isPaid,
    });
  } catch (error) {
    console.error('[MPESA STATUS ERROR]', error);
    next(error);
  }
});

router.post('/mpesa/initiate', async (req, res, next) => {
  try {
    const {
      amount,
      phoneNumber,
      purpose = 'annual_fee',
      bookingId = null,
      tutorId: tutorIdFromBody,
    } = req.body;

    if (!amount || !phoneNumber) {
      return res.status(400).json({ message: 'Amount and phone number are required.' });
    }

    const tutorId = req.user ? Number(req.user.sub) : Number(tutorIdFromBody ?? req.body.tutor_id ?? req.body.tutorId);

    if (!tutorId || Number.isNaN(tutorId)) {
      return res.status(400).json({ message: 'Tutor id is required for the payment prompt.' });
    }

    const normalizedAmount = Number(amount);
    const transactionReference = `${(process.env.MPESA_TRANSACTION_PREFIX || 'SHULE').toUpperCase()}-${Date.now()}`;
    const paymentStatus = hasDarajaConfig() ? 'INITIATED' : 'READY_FOR_PRODUCTION';

    const paymentResult = await query(
      `INSERT INTO payments (
        tutor_id,
        booking_id,
        phone_number,
        amount,
        currency,
        status,
        provider,
        purpose,
        merchant_request_id,
        checkout_request_id,
        transaction_reference,
        response_code,
        response_description,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, 'KES', $5, 'MPESA', $6, NULL, NULL, $7, NULL, $8, NOW(), NOW())
      RETURNING *`,
      [
        tutorId,
        bookingId ? Number(bookingId) : null,
        phoneNumber,
        normalizedAmount,
        paymentStatus,
        purpose,
        transactionReference,
        hasDarajaConfig() ? 'STK push queued for Daraja.' : 'Daraja config missing. Ready for deployment replacement.',
      ]
    );

    if (!hasDarajaConfig()) {
      return res.status(202).json({
        message: 'M-Pesa STK push is not activated in this environment yet. Add the production Daraja keys to MPESA_* env vars before deployment.',
        payment: paymentResult.rows[0],
        productionReady: false,
      });
    }

    const accessToken = await getDarajaAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const password = Buffer.from(
      `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`,
      'utf8'
    ).toString('base64');

    console.log('[MPESA INITIATE]', {
      tutorId,
      amount: normalizedAmount,
      phoneNumber,
      purpose,
      transactionReference,
      callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://example.com/mpesa/callback',
      darajaEnv: process.env.MPESA_ENVIRONMENT || 'sandbox',
    });

    const response = await fetch(`${getDarajaBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerBuyGoodsOnline',
        Amount: normalizedAmount,
        PartyA: phoneNumber.replace(/\D/g, ''),
        PartyB: 5628512,
        PhoneNumber: phoneNumber.replace(/\D/g, ''),
        CallBackURL: process.env.MPESA_CALLBACK_URL || 'https://example.com/mpesa/callback',
        AccountReference: purpose,
        TransactionDesc: `Shule AI Plus  Tutor  ${purpose}`,
      }),
    });

    const darajaPayload = await response.json().catch(() => ({}));

    console.log('[MPESA DARAJA RESPONSE]', {
      status: response.status,
      ok: response.ok,
      payload: darajaPayload,
    });

    if (!response.ok) {
      throw new Error(darajaPayload.errorMessage || darajaPayload.message || 'Daraja STK push failed');
    }

    const merchantRequestId = darajaPayload.MerchantRequestID || null;
    const checkoutRequestId = darajaPayload.CheckoutRequestID || null;

    await query(
      `UPDATE payments
       SET status = 'INITIATED',
           merchant_request_id = COALESCE($1, merchant_request_id),
           checkout_request_id = COALESCE($2, checkout_request_id),
           response_code = COALESCE($3, response_code),
           response_description = COALESCE($4, response_description),
           updated_at = NOW()
       WHERE id = $5`,
      [
        merchantRequestId,
        checkoutRequestId,
        darajaPayload.ResponseCode != null ? String(darajaPayload.ResponseCode) : null,
        darajaPayload.ResponseDescription || null,
        paymentResult.rows[0].id,
      ]
    );

    res.status(201).json({
      message: 'M-Pesa STK push initiated successfully.',
      payment: { ...paymentResult.rows[0], merchantRequestId, checkoutRequestId },
      productionReady: true,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/mpesa/callback', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const callback = payload?.Body?.stkCallback || payload?.stkCallback || payload || {};
    const rawResultCode = callback.ResultCode ?? callback.resultCode;
    const resultCode = rawResultCode === undefined || rawResultCode === null ? -1 : Number(rawResultCode);
    const resultDesc = callback.ResultDesc || callback.resultDesc || 'M-Pesa callback';
    const callbackMetadata = callback.CallbackMetadata || callback.callbackMetadata || {};
    const itemList = Array.isArray(callbackMetadata.Item) ? callbackMetadata.Item : [];
    const receiptItem = itemList.find((item) => item.Name === 'MpesaReceiptNumber');
    const transactionRefItem = itemList.find((item) => item.Name === 'TransactionDate');
    const amountItem = itemList.find((item) => item.Name === 'Amount');
    const phoneItem = itemList.find((item) => item.Name === 'PhoneNumber');
    const requestId = callback.MerchantRequestID || callback.merchantRequestID || payload.MerchantRequestID || payload.merchantRequestID || null;
    const checkoutRequestId = callback.CheckoutRequestID || callback.checkoutRequestID || payload.CheckoutRequestID || payload.checkoutRequestID || null;
    const phoneNumber = phoneItem ? String(phoneItem.Value) : (callback.PhoneNumber || callback.phoneNumber || payload.PhoneNumber || payload.phoneNumber || null);
    const amount = amountItem ? Number(amountItem.Value) : (callback.Amount || callback.amount || payload.Amount || payload.amount || null);
    const cancelledCodes = ['1032', '1037', '1038', '1041'];
    const normalizedStatus = resultCode === 0 ? 'PAID' : cancelledCodes.includes(String(resultCode)) ? 'CANCELLED' : 'FAILED';

    console.log('[MPESA CALLBACK IN]', {
      requestId,
      checkoutRequestId,
      resultCode,
      resultDesc,
      phoneNumber,
      amount,
      normalizedStatus,
      callbackShape: callback,
    });

    const paymentResult = await query(
      `UPDATE payments
       SET status = $1,
           response_code = $2,
           response_description = $3,
           merchant_request_id = COALESCE($4, merchant_request_id),
           checkout_request_id = COALESCE($5, checkout_request_id),
           phone_number = COALESCE($6, phone_number),
           amount = COALESCE(CAST($7 AS NUMERIC), amount),
           mpesa_receipt_number = COALESCE($8, mpesa_receipt_number),
           updated_at = NOW()
       WHERE merchant_request_id = $4 OR checkout_request_id = $5
       RETURNING *`,
      [
        normalizedStatus,
        String(resultCode),
        resultDesc,
        requestId,
        checkoutRequestId,
        phoneNumber,
        amount,
        receiptItem ? receiptItem.Value : null,
      ]
    );

    if (paymentResult.rows.length > 0) {
      const payment = paymentResult.rows[0];
      if (payment.booking_id) {
        const bookingStatus = resultCode === 0 ? 'Confirmed' : cancelledCodes.includes(String(resultCode)) ? 'Cancelled' : 'Cancelled';
        await query(
          `UPDATE bookings
           SET status = $1
           WHERE id = $2`,
          [bookingStatus, payment.booking_id]
        );
      }
      if (payment.tutor_id) {
        if (resultCode === 0) {
          await query(
            `UPDATE tutors
             SET annual_fee_paid = TRUE,
                 is_active = TRUE,
                 updated_at = NOW()
             WHERE id = $1`,
            [payment.tutor_id]
          );
        } else {
          await query(
            `UPDATE tutors
             SET annual_fee_paid = FALSE,
                 is_active = FALSE,
                 updated_at = NOW()
             WHERE id = $1`,
            [payment.tutor_id]
          );
        }
      }
    }

    console.log('[MPESA CALLBACK OUT]', {
      rowsUpdated: paymentResult.rowCount,
      status: normalizedStatus,
      requestId,
      checkoutRequestId,
      transactionDate: transactionRefItem ? transactionRefItem.Value : null,
    });

    return res.json({
      message: 'M-Pesa callback processed.',
      updated: paymentResult.rowCount,
      status: normalizedStatus,
      transactionDate: transactionRefItem ? transactionRefItem.Value : null,
    });
  } catch (error) {
    console.error('[MPESA CALLBACK ERROR]', error);
    next(error);
  }
});

module.exports = router;
