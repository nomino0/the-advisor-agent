# Déploiement CloudWise AI - Guide Complet

## Table des Matières

1. [🚀 Démarrage Rapide](#démarrage-rapide)
2. [🔧 Installation Détaillée](#installation-détaillée)
3. [💻 Utilisation sur Différents PC](#utilisation-sur-différents-pc)
4. [🐛 Dépannage](#dépannage)
5. [🔒 Sécurité en Production](#sécurité-en-production)

---

## 🚀 Démarrage Rapide

### Pour Windows:

```powershell
# 1. Installer Docker Desktop
# Télécharger depuis: https://www.docker.com/products/docker-desktop

# 2. Cloner le projet
git clone <repository-url>
cd the-advisor-agent

# 3. Exécuter le script de déploiement
deploy.bat

# 4. Sélectionner "1 - Start all services"

# 5. Accéder à l'application
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

### Pour Linux/macOS:

```bash
# 1. Installer Docker
# Suivre: https://docs.docker.com/engine/install/

# 2. Cloner le projet
git clone <repository-url>
cd the-advisor-agent

# 3. Rendre le script exécutable et le lancer
chmod +x deploy.sh
./deploy.sh

# 4. Sélectionner l'option 1

# 5. Accéder à l'application
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```

---

## 🔧 Installation Détaillée

### Prérequis Système

- **RAM**: Minimum 4GB (8GB+ recommandé)
- **Disque**: 5GB d'espace libre
- **CPU**: Processeur multi-cœur (4+ cœurs requis)
- **Connexion Internet**: Pour télécharger les images Docker

### Étape 1: Installer Docker

#### Windows
1. Télécharger [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
2. Exécuter l'installateur
3. Accepter WSL 2 (Windows Subsystem for Linux) si proposé
4. Redémarrer l'ordinateur
5. Vérifier: `docker --version` dans PowerShell ou CMD

#### macOS
1. Télécharger [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
2. Ouvrir le fichier `.dmg` téléchargé
3. Glisser l'icône Docker dans Applications
4. Lancer Docker depuis Applications
5. Vérifier: `docker --version` dans Terminal

#### Linux (Ubuntu/Debian)
```bash
# Ajouter le repo Docker
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installer Docker
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Autoriser l'utilisateur courant
sudo usermod -aG docker $USER
newgrp docker
```

### Étape 2: Cloner le Projet

```bash
# Avec Git
git clone <repository-url>
cd the-advisor-agent

# OU télécharger manuellement depuis GitHub
# et extraire le fichier ZIP
```

### Étape 3: Configurer les Variables d'Environnement

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

Éditer le fichier `.env`:

```env
# Variables essentielles
OPENAI_API_KEY=sk-your-key-here    # Requis pour les features AI
POSTGRES_PASSWORD=cloudwise_secret
NXT_PUBLIC_API_URL=http://localhost:8000

# Les autres variables sont optionnelles et utilisent les valeurs par défaut
```

### Étape 4: Démarrer les Services

#### Option A: Utiliser le Script (Recommandé)

**Windows:**
```powershell
# Double-cliquer sur deploy.bat
# OU l'exécuter depuis PowerShell:
.\deploy.bat
```

**macOS/Linux:**
```bash
chmod +x deploy.sh
./deploy.sh
```

#### Option B: Commande Docker Compose Directe

```bash
# Démarrer les services
docker-compose up -d

# Voir les logs
docker-composeogs -f

# Arrêter les services
docker-compose down
```

### Étape 5: Vérifier que Tout Fonctionne

```bash
# Frontend
curl http://localhost:3000

# Backend API
curl http://localhost:8000/api/v1/health

# Résultat attendu:
# {"status":"ok"} ou similaire
```

---

## 💻 Utilisation sur Différents PC

### Migration vers un Nouveau PC

#### Préparation sur PC Source:

```bash
# 1. Commit les changements
git add .
git commit -m "Project ready for deployment"

# 2. Exporter la configuration
# (Copier le repo git suffit, .env n'est pas inclus)
```

#### Installation sur PC Destination:

```bash
# 1. Cloner le projet
git clone <repository-url>
cd the-advisor-agent

# 2. Installer Docker (voir section Prérequis)

# 3. Créer .env
cp .env.example .env

# 4. Éditer .env avec les bonnes valeurs
# - Changer OPENAI_API_KEY
# - Changer les mots de passe si différent
# - Mettre à jour NEXT_PUBLIC_API_URL si nécessaire

# 5. Démarrer
docker-compose up -d

# 6. Vérifier
curl http://localhost:8000/api/v1/health
```

### Personnalisation pour PC Spécifique

#### Changer les Ports

Si les ports par défaut sont utilisés:

```env
# .env
BACKEND_PORT=8001
FRONTEND_PORT=3001
POSTGRES_PORT=5433
REDIS_PORT=6380
```

#### Changer l'Adresse API

Si accédé depuis l'extérieur:

```env
# .env
# Pour accès local
NEXT_PUBLIC_API_URL=http://localhost:8000

# Pour accès réseau (rem lacer IP par votre IP réelle)
NEXT_PUBLIC_API_URL=http://192.168.1.100:8000

# Pour domaine avec certificat
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Deployment en Production

```bash
# Créer docker-compose.prod.yml (fourni)
# Éditer .env avec des valeurs sécurisées

# Démarrer avec config production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Vérifier
docker-compose ps
```

---

## 🐛 Dépannage

### Les services ne démarrent pas

```bash
# Vérifier les logs
docker-compose logs

# Chercher les erreurs (ERROR, Exception, etc.)

# Reconstruire les images
docker-compose build --no-cache

# Redémarrer
docker-compose down
docker-compose up -d
```

### Port déjà utilisé

```bash
# Windows - Identifier quel processus utilise le port
netstat -ano | findstr :8000

# macOS/Linux - Identifier quel processus utilise le port
lsof -i :8000

# Solution: Utiliser des ports différents dans .env
# Voir section "Changer les Ports"
```

### Pas de connexion à la base de données

```bash
# Vérifier que PostgreSQL est en cours d'exécution
docker-compose ps

# Vérifier la santé de la base
docker exec cloudwise-postgres pg_isready -U cloudwise

# Vérifier les logs PostgreSQL
docker-compose logs postgres

# Réinitialiser (supprime toutes les données!)
docker-compose down -v
docker-compose up -d
```

### Problèmes de mémoire

```bash
# Vérifier l'utilisation de la mémoire
docker stats

# Si elle dépasse la limite:
# 1. Augmenter la mémoire allouée à Docker
#    (Docker Desktop > Settings > Resources)
# 2. Réduire les services actifs
# 3. Utiliser des ressources managées (cloud)
```

### Frontend impossible à accéder

```bash
# Vérifier que le conteneur s'exécute
docker-compose logs frontend

# Vérifier le port
curl http://localhost:3000

# Vérifier la variable d'environnement API
docker exec cloudwise-frontend printenv | grep NEXT_PUBLIC_API_URL
```

### Backend lent ou qui plante

```bash
# Vérifier les ressources
docker stats cloudwise-backend

# Vérifier les logs d'erreurs
docker-compose logs -f backend

# Redémarrer le backend
docker-compose restart backend
```

---

## 🔒 Sécurité en Production

### Changements Essentiels

```env
# 1. Changer TOUS les mots de passe par défaut
POSTGRES_PASSWORD=un-mot-de-passe-fort-et-long
REDIS_PASSWORD=un-autre-mot-de-passe-fort-et-long
JWT_SECRET_KEY=une-clé-secrète-de-64-caractères-minimum
SECRET_KEY=une-autre-clé-de-64-caractères

# 2. Définir l'environnement production
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=warning

# 3. Ajouter la clé OpenAI
OPENAI_API_KEY=sk-production-key

# 4. Configurer CORS correctement
BACKEND_CORS_ORIGINS=["https://example.com"]

# 5. Ajouter le domaine
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Recommandations de Sécurité

1. **Certificat SSL/TLS**: Utiliser HTTPS en production
2. **Pare-feu**: Limiter l'accès aux ports 80/443 seulement
3. **Sauvegarde**: Faire des sauvegardes régulières de la base
4. **Logs**: Monitorer les logs pour les anomalies
5. **Updates**: Mettre à jour Docker régulièrement
6. **Secrets**: Utiliser un gestionnaire de secrets (AWS Secrets Manager, Vault)

### Reverse Proxy avec Nginx

Créer `nginx.conf`:

```nginx
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:3000;
}

server {
    listen 80;
    server_name example.com;

    # Rediriger HTTP vers HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Sauvegarder et Restaurer la Base de Données

```bash
# Sauvegarder
docker exec cloudwise-postgres pg_dump -U cloudwise cloudwise_db > backup.sql

# Restaurer
docker exec -i cloudwise-postgres psql -U cloudwise cloudwise_db < backup.sql

# Sauvegarder en compressé
docker exec cloudwise-postgres pg_dump -U cloudwise cloudwise_db | gzip > backup.sql.gz

# Restaurer depuis compressé
gunzip < backup.sql.gz | docker exec -i cloudwise-postgres psql -U cloudwise cloudwise_db
```

---

## 📊 Monitoring et Performance

### Afficher l'utilisation des ressources

```bash
# Voir l'utilisation en temps réel
docker stats

# Voir la consommation disque
docker system df
```

### Logs pour Debugging

```bash
# Tous les logs
docker-compose logs

# Logs récents (50 lignes)
docker composelogs --tail=50

# Logs en direct
docker-compose logs -f

# Logs spécifique (backend only)
docker-compose logs -f backend

# Logs depuis une heure
docker-compose logs --since 1h
```

---

## 📞 Support et Aide

### Fichiers Utiles

- `DOCKER_DEPLOYMENT.md` - Guide complet Docker
- `DOCKER_UPDATES.md` - Résumé des changements
- `.env.example` - Exemple de configuration
- `deploy.bat` / `deploy.sh` - Script de déploiement

### Commandes Utiles

```bash
# État des services
docker-compose ps

# Arrêter tout proprement
docker-compose down

# Nettoyer tout (y compris data)
docker-compose down -v

# Reconstruire
docker-compose build

# Logs détaillés
docker-compose logs --follow

# Exécuter une commande dans un container
docker exec cloudwise-backend bash
```

---

## ✅ Checklist de Déploiement

- [ ] Docker installé et fonctionnel
- [ ] Clonage du projet réussi
- [ ] `.env` créé avec clé API OpenAI
- [ ] Variables d'environnement correctes
- [ ] Services démarrés (`docker-compose up -d`)
- [ ] Frontend accessible (http://localhost:3000)
- [ ] Backend accessible (http://localhost:8000)
- [ ] Base de données connectée
- [ ] Pas d'erreurs dans les logs

---

**Dernier mise à jour**: Février 2026  
**Version**: 1.0
