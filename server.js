const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); // CORS für externe Anfragen aktivieren
const app = express();
const PORT = process.env.PORT || 3000;

// 🔗 Verbindung zur Render-Datenbank über ENV-Variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Render stellt diese automatisch bereit
  ssl: { rejectUnauthorized: false } // Wichtig für Render-Datenbank
});

// 🛠 Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 📌 Zeichnungen speichern
app.post('/save-drawings', async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO drawings (id, data) 
      VALUES (1, $1) 
      ON CONFLICT (id) 
      DO UPDATE SET data = EXCLUDED.data
    `, [JSON.stringify(req.body)]);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Fehler beim Speichern der Zeichnungen:", error);
    res.status(500).json({ success: false });
  }
});

// 📌 Zeichnungen abrufen
app.get('/get-drawings', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM drawings WHERE id = 1');
    res.json(result.rows.length > 0 ? result.rows[0].data : { type: "FeatureCollection", features: [] });
  } catch (error) {
    console.error("❌ Fehler beim Abrufen der Zeichnungen:", error);
    res.status(500).json({ success: false });
  }
});

// 📌 Haus speichern
app.post('/save-house', async (req, res) => {
  const { lat, lon, interest, address, familyName } = req.body;
  try {
    await pool.query(`
      INSERT INTO houses (lat, lon, interest, address, family_name) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (lat, lon) 
      DO UPDATE SET interest = $3, address = $4, family_name = $5
    `, [lat, lon, interest, address, familyName]);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Fehler beim Speichern des Hauses:", error);
    res.status(500).json({ success: false });
  }
});

// 📌 Haus löschen
app.post('/delete-house', async (req, res) => {
  const { lat, lon } = req.body;
  try {
    await pool.query('DELETE FROM houses WHERE lat = $1 AND lon = $2', [lat, lon]);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Fehler beim Löschen des Hauses:", error);
    res.status(500).json({ success: false });
  }
});

// 📌 Zeichnungen löschen
app.post('/delete-drawings', async (req, res) => {
  try {
    await pool.query('UPDATE drawings SET data = $1 WHERE id = 1', [JSON.stringify({ type: "FeatureCollection", features: [] })]);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Fehler beim Löschen der Zeichnungen:", error);
    res.status(500).json({ success: false });
  }
});

// 🌍 Starte den Server
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));

