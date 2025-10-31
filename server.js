// server.js - ARCHIVO NUEVO para Render
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Conexión PostgreSQL para Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta de prueba BD
app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true,
      message: '✅ Conexión a PostgreSQL exitosa!', 
      time: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Redireccionar a tu app principal
app.get('*', (req, res) => {
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Render corriendo en puerto ${PORT}`);
});