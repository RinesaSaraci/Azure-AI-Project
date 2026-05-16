const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

async function connectDatabase() {
    await sql.connect(config);
    console.log('Connected to Azure SQL Database');
}

async function createTable() {

    await sql.query(`
        IF NOT EXISTS (
            SELECT * FROM sysobjects WHERE name='documents'
        )
        CREATE TABLE documents (
            id INT IDENTITY(1,1) PRIMARY KEY,
            type NVARCHAR(50),
            vendor NVARCHAR(255),
            total NVARCHAR(255),
            invoiceDate NVARCHAR(255),
            createdAt DATETIME DEFAULT GETDATE()
        )
    `);
}

async function saveDocument(data) {

    await sql.query`
        INSERT INTO documents (type, vendor, total, invoiceDate)
        VALUES (${data.type}, ${data.vendor}, ${data.total}, ${data.invoiceDate})
    `;
}

async function getDocumentHistory() {

    const result = await sql.query`
        SELECT * FROM documents
        ORDER BY createdAt DESC
    `;

    return result.recordset;
}

module.exports = {
    connectDatabase,
    createTable,
    saveDocument,
    getDocumentHistory
};