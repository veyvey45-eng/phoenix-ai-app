/**
 * Tests pour les nouveaux outils Manus implémentés dans Phoenix
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { toolRegistry } from './toolRegistry';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = '/home/ubuntu/phoenix_test_files';
const testContext = {
  userId: 'test-user',
  sessionId: 'test-session'
};

describe('Nouveaux Outils Phoenix (Style Manus)', () => {
  beforeAll(() => {
    // Créer le répertoire de test
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Nettoyer le répertoire de test
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('file_write', () => {
    it('devrait créer un nouveau fichier', async () => {
      const result = await toolRegistry.execute(
        'file_write',
        {
          path: `${TEST_DIR}/test.txt`,
          content: 'Hello Phoenix!'
        },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('créé');
      expect(fs.existsSync(`${TEST_DIR}/test.txt`)).toBe(true);
    });

    it('devrait ajouter du contenu avec append', async () => {
      // D'abord créer le fichier
      await toolRegistry.execute(
        'file_write',
        { path: `${TEST_DIR}/append.txt`, content: 'Ligne 1\n' },
        testContext
      );

      // Puis ajouter du contenu
      const result = await toolRegistry.execute(
        'file_write',
        { path: `${TEST_DIR}/append.txt`, content: 'Ligne 2\n', append: true },
        testContext
      );

      expect(result.success).toBe(true);
      const content = fs.readFileSync(`${TEST_DIR}/append.txt`, 'utf-8');
      expect(content).toContain('Ligne 1');
      expect(content).toContain('Ligne 2');
    });

    it('devrait refuser les chemins hors du répertoire autorisé', async () => {
      const result = await toolRegistry.execute(
        'file_write',
        { path: '/etc/passwd', content: 'hack' },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Accès refusé');
    });
  });

  describe('file_read', () => {
    it('devrait lire un fichier existant', async () => {
      // Créer un fichier de test
      fs.writeFileSync(`${TEST_DIR}/read_test.txt`, 'Contenu de test');

      const result = await toolRegistry.execute(
        'file_read',
        { path: `${TEST_DIR}/read_test.txt` },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe('Contenu de test');
    });

    it('devrait retourner une erreur pour un fichier inexistant', async () => {
      const result = await toolRegistry.execute(
        'file_read',
        { path: `${TEST_DIR}/inexistant.txt` },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trouvé');
    });
  });

  describe('file_edit', () => {
    it('devrait remplacer du texte dans un fichier', async () => {
      // Créer un fichier de test
      fs.writeFileSync(`${TEST_DIR}/edit_test.txt`, 'Hello World');

      const result = await toolRegistry.execute(
        'file_edit',
        {
          path: `${TEST_DIR}/edit_test.txt`,
          find: 'World',
          replace: 'Phoenix'
        },
        testContext
      );

      expect(result.success).toBe(true);
      const content = fs.readFileSync(`${TEST_DIR}/edit_test.txt`, 'utf-8');
      expect(content).toBe('Hello Phoenix');
    });

    it('devrait remplacer toutes les occurrences avec all=true', async () => {
      fs.writeFileSync(`${TEST_DIR}/edit_all.txt`, 'foo bar foo baz foo');

      const result = await toolRegistry.execute(
        'file_edit',
        {
          path: `${TEST_DIR}/edit_all.txt`,
          find: 'foo',
          replace: 'qux',
          all: true
        },
        testContext
      );

      expect(result.success).toBe(true);
      const content = fs.readFileSync(`${TEST_DIR}/edit_all.txt`, 'utf-8');
      expect(content).toBe('qux bar qux baz qux');
    });
  });

  describe('file_list', () => {
    it('devrait lister les fichiers d\'un répertoire', async () => {
      // Créer quelques fichiers
      fs.writeFileSync(`${TEST_DIR}/file1.txt`, 'content1');
      fs.writeFileSync(`${TEST_DIR}/file2.txt`, 'content2');

      const result = await toolRegistry.execute(
        'file_list',
        { path: TEST_DIR },
        testContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('file1.txt');
      expect(result.output).toContain('file2.txt');
    });
  });

  describe('shell_exec', () => {
    it('devrait être enregistré dans le registry', () => {
      const tool = toolRegistry.get('shell_exec');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('shell_exec');
      expect(tool?.category).toBe('system');
    });

    it('devrait bloquer les commandes dangereuses', async () => {
      const result = await toolRegistry.execute(
        'shell_exec',
        { command: 'rm -rf /' },
        testContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('dangereuse');
    });
  });

  describe('smart_fix', () => {
    it('devrait être enregistré dans le registry', () => {
      const tool = toolRegistry.get('smart_fix');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('smart_fix');
    });
  });

  describe('generate_web_page', () => {
    it('devrait être enregistré dans le registry', () => {
      const tool = toolRegistry.get('generate_web_page');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('generate_web_page');
    });
  });

  describe('browse_web', () => {
    it('devrait être enregistré dans le registry', () => {
      const tool = toolRegistry.get('browse_web');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('browse_web');
    });
  });

  describe('Vérification de tous les outils', () => {
    it('devrait avoir au moins 18 outils enregistrés', () => {
      const tools = toolRegistry.listAll();
      console.log('Outils disponibles:', tools.map(t => t.name).join(', '));
      expect(tools.length).toBeGreaterThanOrEqual(18);
    });

    it('devrait avoir les nouveaux outils Manus', () => {
      const expectedTools = [
        'file_read',
        'file_write',
        'file_edit',
        'file_list',
        'browse_web',
        'shell_exec',
        'generate_web_page',
        'smart_fix'
      ];

      for (const toolName of expectedTools) {
        const tool = toolRegistry.get(toolName);
        expect(tool, `Outil ${toolName} manquant`).toBeDefined();
      }
    });
  });
});
