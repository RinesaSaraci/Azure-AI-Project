const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const databasePath = path.join(__dirname, 'translations.db');
const db = new sqlite3.Database(databasePath);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_text TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            source_language TEXT NOT NULL,
            target_language TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

function saveTranslation(translation) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO translations (
                original_text,
                translated_text,
                source_language,
                target_language
            )
            VALUES (?, ?, ?, ?)
        `;

        db.run(
            query,
            [
                translation.originalText,
                translation.translatedText,
                translation.sourceLanguage,
                translation.targetLanguage
            ],
            function handleInsert(error) {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(this.lastID);
            }
        );
    });
}

function getTranslationHistory() {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT
                id,
                original_text,
                translated_text,
                source_language,
                target_language,
                created_at
            FROM translations
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT 20
        `;

        db.all(query, [], (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows);
        });
    });
}

module.exports = {
    saveTranslation,
    getTranslationHistory
};
