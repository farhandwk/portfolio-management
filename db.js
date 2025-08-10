require('dotenv').config()
const mysql = require('mysql2/promise')

const pool = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
})

console.log("Koneksi ke database berhasil dibuat")

module.exports = pool