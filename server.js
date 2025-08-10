const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Konfigurasi Multer yang sudah diperbaiki
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// === API Endpoints ===

// GET Semua Portfolio
app.get('/api/portfolio', async (req, res) => {
    try {
        // PERBAIKAN: Langsung gunakan db.execute
        const [rows] = await (await db).execute('SELECT * FROM portfolio ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error("Detail Error saat get:", error);
        res.status(500).json({ message: "Error saat mengambil data", error: error.message });
    }
});

// GET Portfolio berdasarkan ID
app.get('/api/portfolio/:id', async (req, res) => {
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
app.post('/api/portfolio', upload.single('image'), async (req, res) => {
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
app.put('/api/portfolio/:id', upload.single('image'), async (req, res) => {
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
app.delete('/api/portfolio/:id', async (req, res) => {
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


// ENDPOINTS UNTUK BLOG/POSTS

function createSlug(title) {
    return title
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');
}


// GET: Mengambil semua post (bisa difilter berdasarkan status)
app.get('/api/posts', async (req, res) => {
    try {
        let query = 'SELECT id, title, slug, excerpt, coverImage, status, createdAt FROM posts WHERE status = "published" ORDER BY createdAt DESC';
        
        // Jika ada query ?status=all dari halaman manajemen, ambil semua post
        if (req.query.status === 'all') {
            query = 'SELECT id, title, slug, status, createdAt FROM posts ORDER BY createdAt DESC';
        }

        const [posts] = await (await db).execute(query);
        res.json(posts);
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ message: "Error fetching posts", error: error.message });
    }
});

// GET: Mengambil satu post berdasarkan SLUG
app.get('/api/posts/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const [rows] = await (await db).execute('SELECT * FROM posts WHERE slug = ? AND status = "published"', [slug]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Post not found" });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error("Error fetching post:", error);
        res.status(500).json({ message: "Error fetching post", error: error.message });
    }
});

// POST: Membuat post baru
app.post('/api/posts', upload.single('coverImage'), async (req, res) => {
    try {
        const { title, content, excerpt, status } = req.body;
        
        if (!title) {
            return res.status(400).json({ message: "Title is required" });
        }

        const slug = createSlug(title);
        const coverImageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const [result] = await (await db).execute(
            'INSERT INTO posts (title, slug, content, excerpt, coverImage, status) VALUES (?, ?, ?, ?, ?, ?)',
            [title, slug, content, excerpt, coverImageUrl, status || 'draft']
        );

        res.status(201).json({ id: result.insertId, slug });
    } catch (error) {
        console.error("Error creating post:", error);
        // Handle duplicate slug error
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A post with this title already exists.' });
        }
        res.status(500).json({ message: "Error creating post", error: error.message });
    }
});

// PUT: Mengupdate post
app.put('/api/posts/:id', upload.single('coverImage'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, excerpt, status } = req.body;
        let { coverImage } = req.body;

        if (req.file) {
            coverImage = `/uploads/${req.file.filename}`;
            // (Opsional: hapus gambar lama dari server)
        }

        const slug = createSlug(title);

        await (await db).execute(
            'UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, coverImage = ?, status = ? WHERE id = ?',
            [title, slug, content, excerpt, coverImage, status, id]
        );

        res.json({ message: 'Post updated successfully' });
    } catch (error) {
        console.error("Error updating post:", error);
        res.status(500).json({ message: "Error updating post", error: error.message });
    }
});


// DELETE: Menghapus post
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // (Opsional: hapus cover image dari folder /uploads)
        await (await db).execute('DELETE FROM posts WHERE id = ?', [id]);
        res.json({ message: "Post deleted successfully" });
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).json({ message: "Error deleting post", error: error.message });
    }
});

app.use((req, res, next) => {
    console.log(`DEBUG: Request masuk ke ${req.method} ${req.originalUrl}, tetapi tidak ada rute yang cocok.`);
    res.status(404).send(`Cannot ${req.method} ${req.originalUrl}`);
});

app.listen(port, () => {
    console.log(`Server berjalan di port: ${port}`);
});