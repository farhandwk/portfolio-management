const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); // Pastikan db tetap diimpor untuk koneksi awal

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Impor dan Gunakan Router ---
const portfolioRoutes = require('./routes/portfolio');
const postRoutes = require('./routes/posts');

app.use('/api/portfolio', portfolioRoutes);
app.use('/api/posts', postRoutes);
// ------------------------------

// Middleware 404 (jika diperlukan)
app.use((req, res, next) => {
    res.status(404).send(`Cannot ${req.method} ${req.originalUrl}`);
});

// Global Error Handler (lebih baik dari middleware 404 biasa)
app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err.stack);
    res.status(500).send('Something broke!');
});


app.listen(port, () => {
    console.log(`Server berjalan di port: ${port}`);
});