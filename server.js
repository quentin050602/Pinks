const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Verbindung zur PostgreSQL-Datenbank auf Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 📌 Zeichnungen speichern (inkl. Farben)
app.post('/save-drawings', async (req, res) => {
  try {
    const geoJsonData = req.body;

    // Speichere Farbe in jeder Zeichnung
    geoJsonData.features.forEach(feature => {
      if (!feature.properties) {
        feature.properties = {};
      }
      if (!feature.properties.color) {
        feature.properties.color = "blue"; // Standardfarbe, falls keine gewählt wurde
      }
    });

    await pool.query(`
      INSERT INTO drawings (id, data) 
      VALUES (1, $1) 
      ON CONFLICT (id) 
      DO UPDATE SET data = EXCLUDED.data
    `, [JSON.stringify(geoJsonData)]);

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Fehler beim Speichern der Zeichnungen:", error);
    res.status(500).json({ success: false });
  }
});

// 📌 Zeichnungen abrufen (mit Farben)
app.get('/get-drawings', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM drawings WHERE id = 1');
    const data = result.rows.length > 0 ? result.rows[0].data : { type: "FeatureCollection", features: [] };

    res.json(data);
  } catch (error) {
    console.error("❌ Fehler beim Abrufen der Zeichnungen:", error);
    res.status(500).json({ success: false });
  }
});

// 📌 Zeichnungen endgültig löschen
app.post('/delete-drawings', async (req, res) => {
  try {
    await pool.query('UPDATE drawings SET data = $1 WHERE id = 1', [JSON.stringify({ type: "FeatureCollection", features: [] })]);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Fehler beim Löschen der Zeichnungen:", error);
    res.status(500).json({ success: false });
  }
});

// 📌 Haus speichern
app.post('/save-house', async (req, res) => {
  const { lat, lon, interest, address, familyName } = req.body;
  try {
    await pool.query(`
      INSERT INTO houses (lat, lon, full_address, interest, family_name) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (lat, lon) 
      DO UPDATE SET full_address = $3, interest = $4, family_name = $5
    `, [lat, lon, address, interest, familyName]);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Fehler beim Speichern des Hauses:", error);
    res.status(500).json({ success: false });
  }
});

// 📌 Häuser abrufen
app.get('/get-houses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM houses');
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Fehler beim Abrufen der Häuser:", error);
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

// Server starten
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));

