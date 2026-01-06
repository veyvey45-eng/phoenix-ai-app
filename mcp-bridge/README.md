# Phoenix MCP Bridge

Le **Phoenix MCP Bridge** est un serveur local qui permet à l'application web Phoenix AI de se connecter à vos serveurs MCP (Model Context Protocol) installés sur votre ordinateur. Grâce à ce bridge, Phoenix peut accéder à vos fichiers locaux, bases de données, outils de recherche et bien plus encore.

---

## Prérequis

Avant d'installer le MCP Bridge, assurez-vous d'avoir les éléments suivants sur votre ordinateur :

| Élément | Version minimale | Vérification |
|---------|------------------|--------------|
| Node.js | 18.0.0 | `node --version` |
| npm | 8.0.0 | `npm --version` |

---

## Installation

### Étape 1 : Télécharger le bridge

Téléchargez le dossier `mcp-bridge` depuis Phoenix ou clonez-le :

```bash
# Option A: Télécharger depuis Phoenix
# Allez dans Phoenix > MCP Bridge > Installation > Télécharger

# Option B: Copier manuellement le dossier mcp-bridge
```

### Étape 2 : Installer les dépendances

Ouvrez un terminal dans le dossier `mcp-bridge` et exécutez :

```bash
cd mcp-bridge
npm install
```

### Étape 3 : Démarrer le bridge

```bash
npm start
```

Au démarrage, vous verrez un affichage similaire à :

```
╔════════════════════════════════════════════════════════════╗
║           🔥 Phoenix MCP Bridge v1.0.0 🔥                  ║
╠════════════════════════════════════════════════════════════╣
║  Port: 8765                                                ║
║  Secret: a1b2c3d4...                                       ║
╚════════════════════════════════════════════════════════════╝

📋 Pour connecter Phoenix:
   1. Allez dans Phoenix > Paramètres > MCP Bridge
   2. URL: ws://localhost:8765
   3. Secret: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Important** : Notez le **Secret** affiché, vous en aurez besoin pour connecter Phoenix.

---

## Connexion depuis Phoenix

Une fois le bridge démarré sur votre PC :

1. Ouvrez Phoenix dans votre navigateur
2. Allez dans le menu **MCP Bridge** (icône prise dans le sidebar)
3. Entrez l'URL : `ws://localhost:8765`
4. Collez le **Secret** affiché au démarrage du bridge
5. Cliquez sur **Se connecter**

Si la connexion réussit, vous verrez le statut passer à "Connecté" avec une coche verte.

---

## Configuration des serveurs MCP

Le bridge détecte automatiquement les serveurs MCP configurés sur votre système. Pour ajouter vos propres serveurs MCP, créez le fichier de configuration suivant :

### Emplacement du fichier

| Système | Chemin |
|---------|--------|
| Linux/Mac | `~/.config/mcp/servers.json` |
| Windows | `%APPDATA%\mcp\servers.json` |
| Alternative | `./mcp-servers.json` (dans le dossier du bridge) |

### Format du fichier

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_votre_token_github"
      }
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "votre_cle_brave"
      }
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-sqlite", "--db-path", "/path/to/database.db"],
      "env": {}
    }
  }
}
```

---

## Serveurs MCP populaires

Voici une liste des serveurs MCP les plus utiles que vous pouvez configurer :

| Serveur | Description | Package |
|---------|-------------|---------|
| **Filesystem** | Accès aux fichiers locaux | `@modelcontextprotocol/server-filesystem` |
| **GitHub** | Gestion de repos, issues, PRs | `@anthropic/mcp-server-github` |
| **Brave Search** | Recherche web | `@anthropic/mcp-server-brave-search` |
| **SQLite** | Base de données locale | `@anthropic/mcp-server-sqlite` |
| **Puppeteer** | Automatisation de navigateur | `@anthropic/mcp-server-puppeteer` |
| **Memory** | Mémoire persistante | `@anthropic/mcp-server-memory` |
| **Slack** | Intégration Slack | `@anthropic/mcp-server-slack` |
| **Google Drive** | Accès Google Drive | `@anthropic/mcp-server-gdrive` |

Pour découvrir tous les serveurs MCP disponibles, visitez : [modelcontextprotocol.io/servers](https://modelcontextprotocol.io/servers)

---

## Variables d'environnement

Vous pouvez personnaliser le comportement du bridge via un fichier `.env` :

```bash
# Port du serveur WebSocket (défaut: 8765)
BRIDGE_PORT=8765

# Secret d'authentification (généré automatiquement si non défini)
BRIDGE_SECRET=votre_secret_personnalise

# Chemin vers la configuration MCP (optionnel)
MCP_CONFIG_PATH=/chemin/vers/servers.json
```

---

## Utilisation avancée

### Démarrer en arrière-plan (Linux/Mac)

```bash
nohup npm start > bridge.log 2>&1 &
```

### Démarrer au boot (systemd)

Créez le fichier `/etc/systemd/system/phoenix-mcp-bridge.service` :

```ini
[Unit]
Description=Phoenix MCP Bridge
After=network.target

[Service]
Type=simple
User=votre_utilisateur
WorkingDirectory=/chemin/vers/mcp-bridge
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Puis activez le service :

```bash
sudo systemctl enable phoenix-mcp-bridge
sudo systemctl start phoenix-mcp-bridge
```

### Démarrer au boot (Windows)

Utilisez le Planificateur de tâches Windows pour exécuter `npm start` au démarrage.

---

## Sécurité

Le MCP Bridge utilise plusieurs mécanismes de sécurité :

1. **Authentification par secret** : Chaque connexion doit fournir le secret correct
2. **Connexion locale** : Par défaut, le bridge n'écoute que sur localhost
3. **Pas de stockage de données** : Le bridge ne stocke aucune donnée sensible

**Recommandations** :
- Ne partagez jamais votre secret
- Gardez le bridge à jour
- N'exposez pas le port 8765 sur Internet

---

## Dépannage

### Le bridge ne démarre pas

```bash
# Vérifiez que Node.js est installé
node --version

# Vérifiez que le port n'est pas utilisé
lsof -i :8765  # Linux/Mac
netstat -ano | findstr :8765  # Windows
```

### Phoenix ne peut pas se connecter

1. Vérifiez que le bridge est en cours d'exécution
2. Vérifiez que l'URL est correcte (`ws://localhost:8765`)
3. Vérifiez que le secret est correct
4. Vérifiez votre pare-feu

### Un serveur MCP ne démarre pas

```bash
# Testez le serveur MCP directement
npx -y @modelcontextprotocol/server-filesystem /home/user
```

---

## Support

Pour toute question ou problème :
- Consultez la documentation Phoenix
- Ouvrez une issue sur GitHub
- Contactez le support Phoenix

---

## Licence

MIT License - Voir le fichier LICENSE pour plus de détails.
