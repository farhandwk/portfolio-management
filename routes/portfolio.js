const express = require('express');
const router = express.Router();
const db = require('../db'); // Path ke db sekarang '../db'
const upload = require('../uploads'); // Kita akan buat file upload terpisah

// === API Endpoints ===

// GET Semua Portfolio
router.get('/', async (req, res) => {
    try {
        // PERBAIKAN: Langsung gunakan db.execute
        const [rows] = await db.execute('SELECT * FROM portfolio ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error("Detail Error saat get:", error);
        res.status(500).json({ message: "Error saat mengambil data", error: error.message });
    }
});

// GET Portfolio berdasarkan ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await (await db).execute('SELECT * FROM portfolio WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Portfolio tidak ditemukan" });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Error mengambil data", error: error.message });
    }
});

// POST Portfolio baru
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { title, description, projectUrl, githubUrl, tags } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        // PERBAIKAN: Query INSERT yang benar
        const [result] = await (await db).execute(
            'INSERT INTO portfolio (title, description, imageUrl, projectUrl, githubUrl, tags) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description, imageUrl, projectUrl, githubUrl, tags]
        );
        res.status(201).json({ id: result.insertId, title, description, imageUrl, projectUrl, githubUrl, tags });
    } catch (error) {
        console.error("Error menambah data:", error);
        res.status(500).json({ message: "Error menambah data", error: error.message });
    }
});

// PUT (Update) Portfolio
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, projectUrl, githubUrl, tags } = req.body;
        let imageUrl = req.body.imageUrl;

        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }

        // PERBAIKAN: Query UPDATE yang benar
        await (await db).execute(
            'UPDATE portfolio SET title = ?, description = ?, imageUrl = ?, projectUrl = ?, githubUrl = ?, tags = ? WHERE id = ?',
            [title, description, imageUrl, projectUrl, githubUrl, tags, id]
        );
        res.json({ message: 'Portfolio berhasil diupdate' });
    } catch (error) {
        console.error("Error mengupdate data:", error);
        res.status(500).json({ message: "Error mengupdate data", error: error.message });
    }
});

// DELETE Portfolio
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // OPTIMASI: Hanya select kolom yang dibutuhkan
        const [rows] = await (await db).execute('SELECT imageUrl FROM portfolio WHERE id = ?', [id]);
        if (rows.length > 0 && rows[0].imageUrl) {
            const imagePath = path.join(__dirname, rows[0].imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        // PERBAIKAN: Gunakan await untuk memastikan query selesai
        await (await db).execute('DELETE FROM portfolio WHERE id = ?', [id]);
        res.json({ message: "Portfolio berhasil dihapus" });
    } catch (error) {
        console.error("Gagal menghapus portfolio:", error);
        res.status(500).json({ message: "Gagal menghapus portfolio", error: error.message });
    }
});

module.exports = router;