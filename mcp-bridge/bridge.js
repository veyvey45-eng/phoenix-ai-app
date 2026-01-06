#!/usr/bin/env node
/**
 * Phoenix MCP Bridge
 * 
 * Ce script tourne sur votre PC et permet à Phoenix (webapp) de se connecter
 * à vos serveurs MCP locaux via WebSocket sécurisé.
 * 
 * Usage:
 *   npm install
 *   npm start
 * 
 * Configuration:
 *   Créez un fichier .env avec:
 *   - BRIDGE_PORT=8765
 *   - BRIDGE_SECRET=votre_secret_unique
 *   - MCP_CONFIG_PATH=~/.config/mcp/servers.json (optionnel)
 */

import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import 'dotenv/config';

// Configuration
const PORT = parseInt(process.env.BRIDGE_PORT || '8765');
const SECRET = process.env.BRIDGE_SECRET || randomUUID();
const MCP_CONFIG_PATH = process.env.MCP_CONFIG_PATH || join(homedir(), '.config', 'mcp', 'servers.json');

// État global
const activeMCPProcesses = new Map(); // id -> { process, stdin, stdout }
const authenticatedClients = new Set();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           🔥 Phoenix MCP Bridge v1.0.0 🔥                  ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log(`║  Port: ${PORT}                                              ║`);
console.log(`║  Secret: ${SECRET.substring(0, 8)}...                                    ║`);
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Sauvegarder le secret si généré automatiquement
if (!process.env.BRIDGE_SECRET) {
  const envPath = join(process.cwd(), '.env');
  const envContent = `BRIDGE_PORT=${PORT}\nBRIDGE_SECRET=${SECRET}\n`;
  writeFileSync(envPath, envContent);
  console.log(`⚠️  Secret généré automatiquement et sauvegardé dans .env`);
  console.log(`📋 Copiez ce secret dans Phoenix: ${SECRET}`);
  console.log('');
}

// Charger la configuration MCP
function loadMCPConfig() {
  const defaultConfig = {
    mcpServers: {}
  };

  // Chercher dans plusieurs emplacements
  const possiblePaths = [
    MCP_CONFIG_PATH,
    join(homedir(), '.config', 'mcp', 'servers.json'),
    join(homedir(), '.mcp', 'servers.json'),
    join(homedir(), 'AppData', 'Roaming', 'mcp', 'servers.json'), // Windows
    join(process.cwd(), 'mcp-servers.json'),
  ];

  for (const configPath of possiblePaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        console.log(`✅ Configuration MCP chargée depuis: ${configPath}`);
        return config;
      } catch (e) {
        console.warn(`⚠️  Erreur lecture config ${configPath}:`, e.message);
      }
    }
  }

  console.log('ℹ️  Aucune configuration MCP trouvée, utilisation des valeurs par défaut');
  return defaultConfig;
}

// Découvrir les MCP installés
function discoverMCPServers() {
  const config = loadMCPConfig();
  const servers = [];

  // Serveurs depuis la config
  if (config.mcpServers) {
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
      servers.push({
        id: name,
        name: name,
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {},
        status: 'available',
        source: 'config'
      });
    }
  }

  // Détecter les MCP courants installés globalement
  const commonMCPs = [
    { name: 'filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', homedir()] },
    { name: 'brave-search', command: 'npx', args: ['-y', '@anthropic/mcp-server-brave-search'] },
    { name: 'github', command: 'npx', args: ['-y', '@anthropic/mcp-server-github'] },
    { name: 'sqlite', command: 'npx', args: ['-y', '@anthropic/mcp-server-sqlite'] },
    { name: 'puppeteer', command: 'npx', args: ['-y', '@anthropic/mcp-server-puppeteer'] },
    { name: 'memory', command: 'npx', args: ['-y', '@anthropic/mcp-server-memory'] },
  ];

  for (const mcp of commonMCPs) {
    if (!servers.find(s => s.name === mcp.name)) {
      servers.push({
        id: mcp.name,
        name: mcp.name,
        command: mcp.command,
        args: mcp.args,
        env: {},
        status: 'detected',
        source: 'auto-detect'
      });
    }
  }

  console.log(`📦 ${servers.length} serveurs MCP découverts`);
  return servers;
}

// Démarrer un serveur MCP
async function startMCPServer(serverId, serverConfig) {
  if (activeMCPProcesses.has(serverId)) {
    console.log(`⚠️  MCP ${serverId} déjà en cours d'exécution`);
    return { success: true, message: 'Already running' };
  }

  try {
    console.log(`🚀 Démarrage MCP: ${serverId}`);
    console.log(`   Command: ${serverConfig.command} ${serverConfig.args.join(' ')}`);

    const mcpProcess = spawn(serverConfig.command, serverConfig.args, {
      env: { ...process.env, ...serverConfig.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    const processInfo = {
      process: mcpProcess,
      serverId,
      config: serverConfig,
      buffer: '',
      responses: new Map(), // requestId -> { resolve, reject }
    };

    // Gérer stdout (réponses JSON-RPC)
    mcpProcess.stdout.on('data', (data) => {
      processInfo.buffer += data.toString();
      
      // Traiter les messages JSON-RPC complets
      const lines = processInfo.buffer.split('\n');
      processInfo.buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            console.log(`📥 MCP ${serverId} response:`, JSON.stringify(message).substring(0, 100));
            
            // Résoudre la promesse correspondante
            if (message.id && processInfo.responses.has(message.id)) {
              const { resolve } = processInfo.responses.get(message.id);
              processInfo.responses.delete(message.id);
              resolve(message);
            }
          } catch (e) {
            // Pas du JSON valide, ignorer
          }
        }
      }
    });

    mcpProcess.stderr.on('data', (data) => {
      console.error(`⚠️  MCP ${serverId} stderr:`, data.toString());
    });

    mcpProcess.on('error', (error) => {
      console.error(`❌ MCP ${serverId} error:`, error.message);
      activeMCPProcesses.delete(serverId);
    });

    mcpProcess.on('close', (code) => {
      console.log(`🛑 MCP ${serverId} fermé avec code ${code}`);
      activeMCPProcesses.delete(serverId);
    });

    activeMCPProcesses.set(serverId, processInfo);

    // Attendre un peu que le processus démarre
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialiser la connexion MCP
    const initResult = await sendMCPRequest(serverId, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'phoenix-mcp-bridge',
        version: '1.0.0'
      }
    });

    console.log(`✅ MCP ${serverId} initialisé:`, initResult?.result?.serverInfo?.name || 'OK');

    return { success: true, message: 'Started', serverInfo: initResult?.result };
  } catch (error) {
    console.error(`❌ Erreur démarrage MCP ${serverId}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Envoyer une requête à un MCP
async function sendMCPRequest(serverId, method, params = {}) {
  const processInfo = activeMCPProcesses.get(serverId);
  if (!processInfo) {
    throw new Error(`MCP ${serverId} not running`);
  }

  const requestId = randomUUID();
  const request = {
    jsonrpc: '2.0',
    id: requestId,
    method,
    params
  };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      processInfo.responses.delete(requestId);
      reject(new Error('MCP request timeout'));
    }, 30000);

    processInfo.responses.set(requestId, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    });

    const requestStr = JSON.stringify(request) + '\n';
    console.log(`📤 MCP ${serverId} request:`, method);
    processInfo.process.stdin.write(requestStr);
  });
}

// Arrêter un serveur MCP
function stopMCPServer(serverId) {
  const processInfo = activeMCPProcesses.get(serverId);
  if (processInfo) {
    processInfo.process.kill();
    activeMCPProcesses.delete(serverId);
    console.log(`🛑 MCP ${serverId} arrêté`);
    return { success: true };
  }
  return { success: false, error: 'Not running' };
}

// Créer le serveur WebSocket
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  const clientId = randomUUID();
  console.log(`🔌 Nouvelle connexion: ${clientId}`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Message reçu:`, message.type);

      // Authentification requise pour toutes les commandes sauf 'auth'
      if (message.type !== 'auth' && !authenticatedClients.has(ws)) {
        ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
        return;
      }

      switch (message.type) {
        case 'auth':
          if (message.secret === SECRET) {
            authenticatedClients.add(ws);
            ws.send(JSON.stringify({ 
              type: 'auth_success', 
              message: 'Authenticated successfully',
              bridgeVersion: '1.0.0'
            }));
            console.log(`✅ Client ${clientId} authentifié`);
          } else {
            ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid secret' }));
            console.log(`❌ Échec auth client ${clientId}`);
          }
          break;

        case 'discover':
          const servers = discoverMCPServers();
          ws.send(JSON.stringify({ type: 'servers', servers }));
          break;

        case 'start_mcp':
          const startResult = await startMCPServer(message.serverId, message.config);
          ws.send(JSON.stringify({ type: 'start_result', serverId: message.serverId, ...startResult }));
          break;

        case 'stop_mcp':
          const stopResult = stopMCPServer(message.serverId);
          ws.send(JSON.stringify({ type: 'stop_result', serverId: message.serverId, ...stopResult }));
          break;

        case 'mcp_request':
          try {
            const result = await sendMCPRequest(message.serverId, message.method, message.params);
            ws.send(JSON.stringify({ 
              type: 'mcp_response', 
              requestId: message.requestId,
              serverId: message.serverId, 
              result 
            }));
          } catch (error) {
            ws.send(JSON.stringify({ 
              type: 'mcp_error', 
              requestId: message.requestId,
              serverId: message.serverId, 
              error: error.message 
            }));
          }
          break;

        case 'list_tools':
          try {
            const toolsResult = await sendMCPRequest(message.serverId, 'tools/list', {});
            ws.send(JSON.stringify({ 
              type: 'tools_list', 
              serverId: message.serverId, 
              tools: toolsResult?.result?.tools || [] 
            }));
          } catch (error) {
            ws.send(JSON.stringify({ 
              type: 'tools_error', 
              serverId: message.serverId, 
              error: error.message 
            }));
          }
          break;

        case 'call_tool':
          try {
            const toolResult = await sendMCPRequest(message.serverId, 'tools/call', {
              name: message.toolName,
              arguments: message.arguments || {}
            });
            ws.send(JSON.stringify({ 
              type: 'tool_result', 
              requestId: message.requestId,
              serverId: message.serverId,
              toolName: message.toolName,
              result: toolResult?.result 
            }));
          } catch (error) {
            ws.send(JSON.stringify({ 
              type: 'tool_error', 
              requestId: message.requestId,
              serverId: message.serverId,
              toolName: message.toolName,
              error: error.message 
            }));
          }
          break;

        case 'status':
          const status = {
            type: 'status',
            connected: true,
            activeMCPs: Array.from(activeMCPProcesses.keys()),
            uptime: process.uptime()
          };
          ws.send(JSON.stringify(status));
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${message.type}` }));
      }
    } catch (error) {
      console.error('❌ Erreur traitement message:', error);
      ws.send(JSON.stringify({ type: 'error', error: error.message }));
    }
  });

  ws.on('close', () => {
    authenticatedClients.delete(ws);
    console.log(`🔌 Client ${clientId} déconnecté`);
  });

  ws.on('error', (error) => {
    console.error(`❌ Erreur WebSocket:`, error.message);
  });
});

console.log(`🌐 WebSocket server listening on ws://localhost:${PORT}`);
console.log('');
console.log('📋 Pour connecter Phoenix:');
console.log(`   1. Allez dans Phoenix > Paramètres > MCP Bridge`);
console.log(`   2. URL: ws://localhost:${PORT}`);
console.log(`   3. Secret: ${SECRET}`);
console.log('');
console.log('⏳ En attente de connexions...');

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
  console.log('\\n🛑 Arrêt du bridge...');
  for (const [serverId] of activeMCPProcesses) {
    stopMCPServer(serverId);
  }
  wss.close();
  process.exit(0);
});
