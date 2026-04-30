const express = require('express');
const cors = require('cors');
const handleValidate = require('./src/routes/validate');
const handleLoader = require('./src/routes/loader');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1kb' }));

app.post('/api/validate', handleValidate);
app.get('/api/loader/v3/scaled-loader.js', handleLoader);
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`[Vexel Runtime] listening on port ${PORT}`);
});
