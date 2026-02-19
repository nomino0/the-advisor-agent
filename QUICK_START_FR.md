# 🚀 CloudWise AI - Démarrage Rapide

**Lancez l'application en 5 minutes sur n'importe quel PC!**

## 📋 Avant de Commencer

Vous avez besoin de:
- **Docker Desktop** (télécharger: https://www.docker.com/products/docker-desktop )
- **Clé API OpenAI** (obtenir: https://platform.openai.com/api-keys)
- **5 GB d'espace disque**
- **PC avec 4GB+ de RAM**

## ⚡ Démarrage en 5 Étapes

### Étape 1️⃣ - Installer Docker

1. Aller sur https://www.docker.com/products/docker-desktop
2. Télécharger et installer Docker Desktop
3. Redémarrer l'ordinateur
4. Ouvrir terminal (PowerShell ou CMD) et vérifier:
   ```
   docker --version
   ```

### Étape 2️⃣ - Cloner le Projet

```bash
git clone <repository-url>
cd the-advisor-agent
```

### Étape 3️⃣ - Configurer l'Application

#### Windows:
```powershell
copy .env.example .env
notepad .env
```

#### macOS/Linux:
```bash
cp .env.example .env
nano .env
```

**À configurer obligatoirement:**
```env
OPENAI_API_KEY=sk-votre-clé-api-openai
```

D'autres variables sont optionnelles (regarder les commentaires).

### Étape 4️⃣ - Lancer les Services

#### **Windows** - Double-cliquez sur:
```
deploy.bat
```

Ensuite, appuyez sur `1` pour démarrer.

#### **Linux/macOS**:
```bash
chmod +x deploy.sh
./deploy.sh
```

Ensuite, sélectionnez `1`.

### Étape 5️⃣ - Accédez à l'Application

```
Frontend: http://localhost:3000
Backend:  http://localhost:8000
API Docs: http://localhost:8000/docs
```

## 🛠️ Commandes Utiles

| Action | Commande |
|--------|----------|
| **Démarrer** | `docker-compose up -d` |
| **Arrêter** | `docker-compose down` |
| **Voir les logs** | `docker-compose logs -f` |
| **État des services** | `docker-compose ps` |
| **Réinitialiser (supprime données)** | `docker-compose down -v` |

## ❓ Problèmes Courants?

### ❌ "Docker not found"
**→ Solution:** Installer Docker Desktop depuis https://docker.com

### ❌ "Port 8000 already in use"
**→ Solution:** Éditer `.env` et changer `BACKEND_PORT=8001`

### ❌ "API key error"
**→ Solution:** Ajouter `OPENAI_API_KEY=sk-...` dans `.env`

### ❌ Services qui ne démarrent pas
```bash
# Voir les erreurs
docker-compose logs

# Reconstruire les images
docker-compose build --no-cache

# Redémarrer
docker-compose down
docker-compose up -d
```

## 📚 Documentation Complète

- **[DEPLOYMENT_FR.md](DEPLOYMENT_FR.md)** - Guide complet en français
- **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Guide technique Docker
- **[DOCKER_UPDATES.md](DOCKER_UPDATES.md)** - Résumé des mises à jour

## ✅ Vérification

Vérifier que tout fonctionne:

```bash
# Test le frontend
curl http://localhost:3000

# Test le backend
curl http://localhost:8000/api/v1/health

# Devrait afficher quelque chose comme: {"status":"ok"}
```

## 🔒 Important pour la Production

Avant de mettre en production, éditer `.env` et:

1. Changer tous les mots de passe par défaut
2. Utiliser des domaines HTTPS
3. Configurer correctement CORS
4. Faire des sauvegardes régulières

Voir **[DEPLOYMENT_FR.md](DEPLOYMENT_FR.md)** pour plus de détails.

## 📞 Besoin d'Aide?

1. Vérifier les **logs**:
   ```bash
   docker-compose logs
   ```

2. Lancer les **vérifications de santé**:
   - Windows: `health-check.bat`
   - Linux/macOS: `./health-check.sh`

3. Consulter la **documentation complète**:
   - Français: [DEPLOYMENT_FR.md](DEPLOYMENT_FR.md)
   - Anglais: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)

---

**C'est tout! 🎉 Votre application CloudWise AI est maintenant opérationnelle!**

Pour plus d'options, consultez les fichiers de documentation.
