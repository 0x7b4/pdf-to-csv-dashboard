const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { createObjectCsvWriter } = require('csv-writer');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Créer les dossiers s'ils n'existent pas
['uploads', 'output'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configuration Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Seuls les fichiers PDF sont acceptés'));
    }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Client Claude AI
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'PDF to CSV Dashboard is running',
        claudeConfigured: !!process.env.ANTHROPIC_API_KEY,
        timestamp: new Date().toISOString()
    });
});

app.post('/api/convert', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier PDF fourni' });
        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Clé API Claude non configurée' });
        }

        console.log(`[INFO] Traitement: ${req.file.originalname}`);

        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        const pdfText = pdfData.text;

        console.log(`[INFO] Texte extrait: ${pdfText.length} caractères`);

        if (!pdfText.length) throw new Error('PDF vide ou non extractible');

        const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: `Tu es un expert en extraction de données. Analyse ce PDF et extrais les données structurées en JSON:
{
  "headers": ["col1", "col2", ...],
  "rows": [["val1", "val2", ...], ...],
  "metadata": {"source": "desc", "rowCount": n}
}
Si aucune structure, utilise: ["Section", "Contenu"]

Texte: ${pdfText.substring(0, 50000)}`
            }]
        });

        const responseText = message.content[0].text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSON non extractible');

        const extractedData = JSON.parse(jsonMatch[0]);
        if (!extractedData.headers || !extractedData.rows) {
            throw new Error('Format invalide');
        }

        const csvFileName = `output-${Date.now()}.csv`;
        const csvFilePath = path.join(__dirname, 'output', csvFileName);
        const csvWriter = createObjectCsvWriter({
            path: csvFilePath,
            header: extractedData.headers.map(h => ({ id: h, title: h }))
        });

        const records = extractedData.rows.map(row => {
            const record = {};
            extractedData.headers.forEach((header, index) => {
                record[header] = row[index] || '';
            });
            return record;
        });

        await csvWriter.writeRecords(records);
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            message: 'Conversion réussie',
            csvFile: csvFileName,
            downloadUrl: `/api/download/${csvFileName}`,
            metadata: {
                originalFile: req.file.originalname,
                rowsExtracted: extractedData.rows.length,
                columnsExtracted: extractedData.headers.length
            }
        });

    } catch (error) {
        console.error('[ERROR]', error);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Erreur conversion', details: error.message });
    }
});

app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'output', req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier non trouvé' });
    res.download(filePath, req.params.filename);
});

app.get('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(path.join(__dirname, 'output'))
            .filter(f => f.endsWith('.csv') && f !== '.gitkeep')
            .map(filename => {
                const stats = fs.statSync(path.join(__dirname, 'output', filename));
                return {
                    filename,
                    size: stats.size,
                    created: stats.birthtime,
                    downloadUrl: `/api/download/${filename}`
                };
            })
            .sort((a, b) => b.created - a.created);
        res.json({ files });
    } catch (error) {
        res.status(500).json({ error: 'Erreur récupération fichiers' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur sur port ${PORT}`);
    console.log(`🤖 Claude AI: ${process.env.ANTHROPIC_API_KEY ? '✓' : '✗'}`);
});