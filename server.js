const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { createObjectCsvWriter } = require('csv-writer');
const Anthropic = require('anthropic');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration Multer pour upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Seuls les fichiers PDF sont acceptés'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Client Claude AI
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'PDF to CSV Dashboard is running',
        claudeConfigured: !!process.env.ANTHROPIC_API_KEY 
    });
});

// Route d'upload et conversion
app.post('/api/convert', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier PDF fourni' });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Clé API Claude non configurée' });
        }

        console.log(`[INFO] Traitement du fichier: ${req.file.originalname}`);

        // 1. Extraire le texte du PDF
        const dataBuffer = fs.readFileSync(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        const pdfText = pdfData.text;

        console.log(`[INFO] Texte extrait: ${pdfText.length} caractères`);

        // 2. Analyser avec Claude AI
        const message = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: `Tu es un expert en extraction de données structurées. Analyse ce texte extrait d'un PDF et extrais toutes les données structurées que tu peux trouver (tableaux, listes, informations clés).

Retourne un JSON valide avec cette structure :
{
  "headers": ["colonne1", "colonne2", "colonne3", ...],
  "rows": [
    ["valeur1", "valeur2", "valeur3", ...],
    ["valeur1", "valeur2", "valeur3", ...]
  ],
  "metadata": {
    "source": "description de la source des données",
    "rowCount": nombre_de_lignes
  }
}

Si tu ne trouves pas de données structurées, crée au minimum 2 colonnes : "Section" et "Contenu".

Texte du PDF:
${pdfText.substring(0, 50000)}
`
            }]
        });

        const responseText = message.content[0].text;
        console.log(`[INFO] Réponse Claude reçue: ${responseText.length} caractères`);

        // Extraire le JSON de la réponse
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Impossible d\'extraire le JSON de la réponse Claude');
        }

        const extractedData = JSON.parse(jsonMatch[0]);

        // 3. Créer le fichier CSV
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

        console.log(`[INFO] Fichier CSV créé: ${csvFileName}`);

        // 4. Nettoyer le fichier PDF uploadé
        fs.unlinkSync(req.file.path);

        // 5. Retourner le résultat
        res.json({
            success: true,
            message: 'Conversion réussie',
            csvFile: csvFileName,
            downloadUrl: `/api/download/${csvFileName}`,
            metadata: {
                originalFile: req.file.originalname,
                rowsExtracted: extractedData.rows.length,
                columnsExtracted: extractedData.headers.length,
                source: extractedData.metadata?.source || 'PDF'
            }
        });

    } catch (error) {
        console.error('[ERROR]', error);

        // Nettoyer le fichier en cas d'erreur
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Erreur lors de la conversion',
            details: error.message
        });
    }
});

// Route de téléchargement
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'output', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('[ERROR] Téléchargement:', err);
        }
    });
});

// Liste des fichiers convertis
app.get('/api/files', (req, res) => {
    try {
        const files = fs.readdirSync(path.join(__dirname, 'output'))
            .filter(f => f.endsWith('.csv') && f !== '.gitkeep')
            .map(filename => {
                const filePath = path.join(__dirname, 'output', filename);
                const stats = fs.statSync(filePath);
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
        res.status(500).json({ error: 'Erreur lors de la récupération des fichiers' });
    }
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📊 Dashboard PDF to CSV disponible`);
    console.log(`🤖 Claude AI: ${process.env.ANTHROPIC_API_KEY ? 'Configuré ✓' : 'Non configuré ✗'}`);
});
