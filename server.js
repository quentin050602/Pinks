const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
//const bcrypt = require('bcryptjs');
const path = require('path');

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



// 📌 **Login-Seite bereitstellen**
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📌 **Login-Logik**
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log("🔍 Login-Versuch:", username, password);

    try {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);

        if (result.rowCount === 0) {
            return res.status(401).json({ success: false, error: "Benutzer nicht gefunden" });
        }

        const user = result.rows[0];

        if (password !== user.password) {
            return res.status(401).json({ success: false, error: "Falsches Passwort" });
        }

        console.log(`✅ Benutzer ${username} erfolgreich eingeloggt.`);
        res.json({ success: true, username: user.username, role: user.role });

    } catch (error) {
        console.error("❌ Fehler beim Login:", error);
        res.status(500).json({ success: false, error: "Serverfehler" });
    }
});



// 📌 Benutzer anlegen (Nur für Owner)
app.post('/register', async (req, res) => {
    const { ownerUsername, newUsername, password, role, first_name, last_name, email, phone } = req.body;

    console.log(`🔹 Registrierungsversuch durch ${ownerUsername} für ${newUsername}`);

    if (!ownerUsername || !newUsername || !password || !role || !first_name || !last_name || !email) {
        return res.status(400).json({ success: false, error: "Alle Felder außer Telefon sind erforderlich." });
    }

    try {
        // 🔍 Überprüfen, ob der anfragende User ein Owner ist
        const ownerCheck = await pool.query("SELECT * FROM users WHERE username = $1 AND role = 'owner'", [ownerUsername]);

        if (ownerCheck.rowCount === 0) {
            console.log("❌ Zugriff verweigert! Nur Owner dürfen Benutzer hinzufügen.");
            return res.status(403).json({ success: false, error: "Nur Owner dürfen Benutzer hinzufügen." });
        }

        // 🔍 Prüfen, ob der Benutzername bereits existiert
        const userCheck = await pool.query("SELECT * FROM users WHERE username = $1", [newUsername]);

        if (userCheck.rowCount > 0) {
            console.log("❌ Benutzername existiert bereits!");
            return res.status(400).json({ success: false, error: "Benutzername existiert bereits!" });
        }

        // ✅ Neuen Benutzer anlegen
        await pool.query(`
            INSERT INTO users (username, password, role, first_name, last_name, email, phone) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [newUsername, password, role, first_name, last_name, email, phone]
        );

        console.log(`✅ Neuer Benutzer ${newUsername} wurde von ${ownerUsername} erstellt.`);
        res.json({ success: true, message: `Benutzer ${newUsername} erfolgreich erstellt.` });

    } catch (error) {
        console.error("❌ Fehler beim Erstellen des Benutzers:", error);
        res.status(500).json({ success: false, error: "Serverfehler" });
    }
});



// 📌 ZIP-Code-Daten aus der DB abrufen
app.get('/get-zipcodes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM zipcodes');
        res.json(result.rows);
    } catch (error) {
        console.error("❌ Fehler beim Abrufen der ZIP-Code-Daten:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});




//Zeichnungen abrufen

app.get('/get-drawings', async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM drawings WHERE id = 1');
        if (result.rows.length > 0) {
            let data = result.rows[0].data;

            // Falls `data` als String gespeichert wurde, in echtes JSON umwandeln
            if (typeof data === "string") {
                data = JSON.parse(data);
            }

            res.json(data);
        } else {
            // Falls keine Daten vorhanden sind, leeres GeoJSON zurückgeben
            res.json({ type: "FeatureCollection", features: [] });
        }
    } catch (error) {
        console.error("❌ Fehler beim Abrufen der Zeichnungen:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// 📌 Zeichnungen speichern (NEU!)
app.post('/save-drawings', async (req, res) => {
    const { data } = req.body;
    if (!data) {
        console.error("❌ Fehler: Keine Zeichnungsdaten erhalten!");
        return res.status(400).json({ success: false, error: "Zeichnungsdaten fehlen" });
    }

    try {
        console.log("📡 Erhalte Zeichnungen:", JSON.stringify(data)); // Debugging

        // Prüfen, ob `id=1` existiert
        const check = await pool.query('SELECT * FROM drawings WHERE id = 1');

        if (check.rowCount > 0) {
            // 🔄 Falls vorhanden, aktualisieren
            await pool.query('UPDATE drawings SET data = $1 WHERE id = 1', [JSON.stringify(data)]);
        } else {
            // ➕ Falls nicht vorhanden, neuen Eintrag erstellen
            await pool.query('INSERT INTO drawings (id, data) VALUES (1, $1)', [JSON.stringify(data)]);
        }

        console.log("✅ Zeichnungen erfolgreich gespeichert!");
        res.json({ success: true });
    } catch (error) {
        console.error("❌ Fehler beim Speichern der Zeichnungen:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// 📌 Zeichnungen endgültig löschen
app.post('/delete-drawings', async (req, res) => {
  try {
    await pool.query('UPDATE drawings SET data = $1 WHERE id = 1', [JSON.stringify({ type: "FeatureCollection", features: [] })]);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Fehler beim Löschen der Zeichnungen:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📌 Haus speichern
app.post('/save-house', async (req, res) => {
  const { lat, lon, interest, address, familyName } = req.body;
  if (!lat || !lon || !interest || !address || !familyName) {
    return res.status(400).json({ success: false, error: "Fehlende Daten für das Haus" });
  }

  try {
    await pool.query(`
      INSERT INTO houses (lat, lon, full_address, interest, family_name) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (lat, lon) 
      DO UPDATE SET full_address = $3, interest = $4, family_name = $5
    `, [lat, lon, address, interest, familyName]);

    console.log(`✅ Haus gespeichert: ${address}, Interesse: ${interest}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Fehler beim Speichern des Hauses:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📌 Häuser abrufen
app.get('/get-houses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM houses');
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Fehler beim Abrufen der Häuser:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📌 Haus löschen
// 📌 Haus löschen mit Debugging
app.post('/delete-house', async (req, res) => {
    const { lat, lon } = req.body;
    
    // 🔍 Debugging: Prüfen, ob `lat` und `lon` korrekt empfangen werden
    console.log("🔹 Eingehende Löschanfrage für:", { lat, lon });

    if (!lat || !lon) {
        console.error("❌ Fehler: Keine Latitude/Longitude erhalten!");
        return res.status(400).json({ success: false, error: "Latitude und Longitude erforderlich" });
    }

    try {
        // 🔍 Debugging: Prüfen, ob das Haus existiert
        const checkExistence = await pool.query('SELECT * FROM houses WHERE lat = $1 AND lon = $2', [lat, lon]);
        if (checkExistence.rowCount === 0) {
            console.warn(`⚠️ Kein Haus gefunden bei: lat=${lat}, lon=${lon}`);
            return res.status(404).json({ success: false, error: "Haus nicht gefunden" });
        }

        // ✅ Haus existiert → Jetzt löschen
        const result = await pool.query('DELETE FROM houses WHERE lat = $1 AND lon = $2 RETURNING *', [lat, lon]);

        if (result.rowCount > 0) {
            console.log(`✅ Haus erfolgreich gelöscht: lat=${lat}, lon=${lon}`);
            res.json({ success: true });
        } else {
            console.error("❌ Unerwarteter Fehler: Haus wurde nicht gelöscht!");
            res.status(500).json({ success: false, error: "Haus wurde nicht gelöscht" });
        } // 🔥 Fehlende geschweifte Klammer hinzugefügt
    } catch (error) {
        console.error("❌ Fehler beim Löschen des Hauses:", error);
        res.status(500).json({ success: false, error: error.message });
    }
}); // 🔥 Fehlende schließende Klammer für `delete-house`

// 📌 Server starten
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));

