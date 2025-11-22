# 📄 PDF to CSV Dashboard

Dashboard Node.js pour extraire intelligemment des données PDF vers CSV avec **Claude AI**.

![Node.js](https://img.shields.io/badge/Node.js-v16+-green)
![Claude AI](https://img.shields.io/badge/Claude-3.5%20Sonnet-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Fonctionnalités

- 📤 **Upload PDF** via glisser-déposer ou sélection de fichier
- 🤖 **Extraction intelligente** avec Claude AI (Sonnet 3.5)
- 📊 **Conversion automatique** en CSV structuré
- 💾 **Téléchargement instantané** des fichiers convertis
- 📁 **Historique** des conversions
- 🎨 **Interface moderne** et responsive

## 🚀 Installation

```bash
# Cloner le repository
git clone https://github.com/0x7b4/pdf-to-csv-dashboard.git
cd pdf-to-csv-dashboard

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env et ajouter votre clé API Claude
```

## 🔑 Configuration

Créez un compte sur [Anthropic Console](https://console.anthropic.com/) et obtenez une clé API.

Éditez le fichier `.env` :

```env
PORT=3000
ANTHROPIC_API_KEY=votre_clé_api_ici
MAX_FILE_SIZE=10485760
```

## 💻 Utilisation

```bash
# Démarrer le serveur
npm start

# Mode développement (avec nodemon)
npm run dev
```

Ouvrez votre navigateur sur `http://localhost:3000`

## 📖 API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/` | GET | Interface dashboard |
| `/api/health` | GET | Statut du serveur |
| `/api/convert` | POST | Convertir PDF en CSV |
| `/api/download/:filename` | GET | Télécharger un CSV |
| `/api/files` | GET | Liste des fichiers convertis |

## 🛠️ Technologies

- **Backend**: Node.js, Express
- **AI**: Claude 3.5 Sonnet (Anthropic)
- **PDF**: pdf-parse
- **CSV**: csv-writer
- **Upload**: Multer
- **Frontend**: HTML5, CSS3, JavaScript vanilla

## 📦 Structure du projet

```
pdf-to-csv-dashboard/
├── public/
│   └── index.html          # Interface utilisateur
├── uploads/                # PDFs temporaires
├── output/                 # Fichiers CSV générés
├── server.js               # Serveur Express
├── package.json
├── .env.example
└── README.md
```

## 🔒 Sécurité

- Limitation de taille de fichier (10 MB par défaut)
- Validation du type MIME
- Nettoyage automatique des uploads temporaires
- Variables d'environnement pour les clés sensibles

## 📝 Exemple de conversion

1. Upload d'un PDF avec tableau de données
2. Claude AI analyse et structure les données
3. Export CSV avec en-têtes et lignes
4. Téléchargement automatique

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📄 Licence

MIT © 2025 0x7b4

## 👨‍💻 Auteur

**0x7b4**
- GitHub: [@0x7b4](https://github.com/0x7b4)
- Blog: [0x7b4.github.io](https://0x7b4.github.io/pentest/)

---

⭐ Si ce projet vous aide, n'hésitez pas à lui donner une étoile !
