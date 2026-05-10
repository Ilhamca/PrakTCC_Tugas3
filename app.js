const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

const dbConfig = {
  host: process.env.DB_HOST || '34.172.113.167',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'mypassword',
  database: process.env.DB_NAME || 'notes_123230106'
};

let pool;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function initDatabase() {
  // Langsung buat pool koneksi ke database notes_123230106 yang sudah Anda buat di phpMyAdmin
  pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Buat tabel jika belum ada
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      judul VARCHAR(255) NOT NULL,
      isi TEXT NOT NULL,
      tanggal_dibuat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      tanggal_diperbarui DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

function formatNoteRow(note) {
  const tanggalDibuat = new Date(note.tanggal_dibuat).toLocaleString('id-ID');
  return {
    id: note.id,
    judul: note.judul,
    isi: note.isi,
    tanggal_dibuat: tanggalDibuat
  };
}

// GET - Lihat daftar catatan
app.get('/api/notes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, judul, isi, tanggal_dibuat FROM notes ORDER BY id DESC');
    res.json(rows.map(formatNoteRow));
  } catch (error) {
    console.error('Gagal mengambil catatan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengambil catatan' });
  }
});

// POST - Tambah catatan
app.post('/api/notes', async (req, res) => {
  const { judul, isi } = req.body;
  
  if (!judul || !isi) {
    return res.status(400).json({ error: 'Judul dan isi harus diisi' });
  }

  try {
    const [result] = await pool.query('INSERT INTO notes (judul, isi) VALUES (?, ?)', [judul, isi]);
    const [rows] = await pool.query('SELECT id, judul, isi, tanggal_dibuat FROM notes WHERE id = ?', [result.insertId]);
    res.status(201).json(formatNoteRow(rows[0]));
  } catch (error) {
    console.error('Gagal menambah catatan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat menambah catatan' });
  }
});

// PUT - Edit catatan
app.put('/api/notes/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { judul, isi } = req.body;

  if (!judul && !isi) {
    return res.status(400).json({ error: 'Minimal judul atau isi harus diisi' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM notes WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Catatan tidak ditemukan' });
    }

    await pool.query(
      'UPDATE notes SET judul = COALESCE(?, judul), isi = COALESCE(?, isi) WHERE id = ?',
      [judul || null, isi || null, id]
    );

    const [rows] = await pool.query('SELECT id, judul, isi, tanggal_dibuat FROM notes WHERE id = ?', [id]);
    res.json(formatNoteRow(rows[0]));
  } catch (error) {
    console.error('Gagal memperbarui catatan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memperbarui catatan' });
  }
});

// DELETE - Hapus catatan
app.delete('/api/notes/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const [rows] = await pool.query('SELECT id, judul, isi, tanggal_dibuat FROM notes WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Catatan tidak ditemukan' });
    }

    await pool.query('DELETE FROM notes WHERE id = ?', [id]);
    res.json(formatNoteRow(rows[0]));
  } catch (error) {
    console.error('Gagal menghapus catatan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat menghapus catatan' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(port, () => {
      console.log(`Aplikasi Note tersedia di http://localhost:${port}`);
      console.log(`Terhubung ke MySQL: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    });
  } catch (error) {
    console.error('Gagal menghubungkan ke MySQL. Pastikan XAMPP MySQL sudah berjalan.');
    console.error(error.message);
    process.exit(1);
  }
}

startServer();