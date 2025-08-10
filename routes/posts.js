const express = require('express');
const router = express.Router();
const db = require('../db');
const upload = require('../uploads');
const { createSlug } = require('../utils'); // Kita akan buat file utils

// GET: Mengambil semua post (bisa difilter berdasarkan status)
router.get('/', async (req, res) => {
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
router.get('/:slug', async (req, res) => {
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
router.post('/', upload.single('coverImage'), async (req, res) => {
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
router.put('/:id', upload.single('coverImage'), async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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

module.exports  = router;