require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const paymentRoutes = require('./routes/paymentRoutes');
const paymongoRoutes = require('./routes/paymongoRoutes');
const { webhook } = require('./controllers/paymentController');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

// Who may call the API from a browser: the website, the Android app (https://localhost) and local testing
const ORIGINS = (process.env.CORS_ORIGIN || 'https://pelotonhub.web.app,https://peletonhub.web.app,https://peletonhub.firebaseapp.com,https://localhost,http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: ORIGINS.includes('*') ? '*' : ORIGINS }));

// PayMongo webhook needs the raw body to check its signature, so it comes before express.json()
app.post('/api/paymongo/webhook', express.raw({ type: 'application/json', limit: '1mb' }), webhook);

app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'pelotonhub-mongo-payment-api', time: new Date().toISOString() }));

app.use('/api/payments', paymentRoutes);
app.use('/api/paymongo', paymongoRoutes);

// 404
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));
});
