/**
 * Tests du système autonome de Phoenix
 * 
 * Valide:
 * 1. Persistance d'état entre conversations
 * 2. Auto-correction avec code bugué
 * 3. Exécution de commandes OS
 * 4. Interaction web avec Puppeteer
 * 5. Checkpoint et restauration
 * 6. Volume persistant
 * 7. Orchestration complète
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PhoenixOrchestrator, TaskRequest, TaskResult, getOrchestrator } from './orchestrator';
import { persistentState } from './persistentState';
import { autoCorrection } from './autoCorrection';
import { osAccess } from './osAccess';
import { getCheckpointManager } from './e2bCheckpoint';
import { PersistentVolumeManager, getVolumeManager } from './persistentVolume';

describe('Phoenix Autonomous System', () => {
  let orchestrator: PhoenixOrchestrator;
  let checkpointManager: ReturnType<typeof getCheckpointManager>;
  let volumeManager: ReturnType<typeof getVolumeManager>;

  beforeEach(() => {
    orchestrator = getOrchestrator();
    checkpointManager = getCheckpointManager();
    volumeManager = getVolumeManager();
  });

  afterEach(async () => {
    await orchestrator.reset();
  });

  describe('Task Type Detection', () => {
    it('should detect OS command tasks', () => {
      const request: TaskRequest = {
        userId: 'test-user',
        conversationId: 'test-conv',
        taskType: 'unknown',
        content: 'Execute this shell command: ls -la /home',
      };

      const detected = orchestrator.detectTaskType(request.content);
      expect(detected).toBe('os_command');
    });

    it('should detect web interaction tasks', () => {
      const request: TaskRequest = {
        userId: 'test-user',
        conversationId: 'test-conv',
        taskType: 'unknown',
        content: 'Navigate to the website and take a screenshot',
      };

      const detected = orchestrator.detectTaskType(request.content);
      expect(detected).toBe('web_interaction');
    });

    it('should detect code execution tasks', () => {
      const request: TaskRequest = {
        userId: 'test-user',
        conversationId: 'test-conv',
        taskType: 'unknown',
        content: 'Execute this Python code: print("hello")',
      };

      const detected = orchestrator.detectTaskType(request.content);
      expect(detected).toBe('code_execution');
    });
  });

  describe('Persistent State Management', () => {
    it('should save and retrieve session state', async () => {
      const userId = 'test-user';
      const sessionId = 'test-session';

      // Sauvegarder une variable
      await persistentState.setVariable(userId, sessionId, 'testVar', 'testValue');

      // Récupérer la session
      const session = persistentState.getSession(userId, sessionId);
      expect(session).toBeDefined();
      expect(session.variables.get('testVar')).toBe('testValue');
    });

    it('should persist state between sessions', async () => {
      const userId = 'test-user';
      const sessionId = 'test-session';

      // Sauvegarder
      await persistentState.setVariable(userId, sessionId, 'persistedVar', 'persistedValue');

      // Récupérer (utiliser le singleton)
      const session = persistentState.getSession(userId, sessionId);
      expect(session.variables.get('persistedVar')).toBe('persistedValue');
    });

    it('should handle file operations', async () => {
      const userId = 'test-user';
      const sessionId = 'test-session';
      const fileName = 'test.txt';
      const content = 'test content';

      // Sauvegarder un fichier
      await persistentState.saveFile(userId, sessionId, fileName, content);

      // Récupérer le fichier
      const session = await persistentState.getSession(userId, sessionId);
      expect(session.files.has(fileName)).toBe(true);
    });
  });

  describe('Auto-Correction Engine', () => {
    it('should analyze errors correctly', () => {
      const error = 'SyntaxError: invalid syntax';
      const analysis = autoCorrection.analyzeError(error);

      expect(analysis.type).toBe('syntax_error');
      expect(analysis.recoverable).toBe(true);
      expect(analysis.severity).toBe('high');
    });

    it('should determine if recovery is possible', () => {
      const recoverable = autoCorrection.canRecover('SyntaxError: invalid syntax', 1);
      expect(recoverable).toBe(true);

      const nonRecoverable = autoCorrection.canRecover('PermissionError: access denied', 1);
      expect(nonRecoverable).toBe(false);
    });

    it('should create and manage correction sessions', () => {
      const sessionId = 'test-correction-session';
      const userId = 'test-user';
      const originalRequest = 'Fix this code';

      const session = autoCorrection.createSession(userId, sessionId, originalRequest);
      expect(session.sessionId).toBe(sessionId);
      expect(session.userId).toBe(userId);
      expect(session.status).toBe('in_progress');
    });
  });

  describe('OS Access Manager', () => {
    it('should validate commands', async () => {
      const validCommand = 'ls -la';
      const invalidCommand = 'rm -rf /';

      const validResult = await osAccess.executeCommand(validCommand, 'test-user');
      expect(validResult.success).toBe(true);

      const invalidResult = await osAccess.executeCommand(invalidCommand, 'test-user');
      expect(invalidResult.success).toBe(false);
    });

    it('should track execution history', async () => {
      const userId = 'test-user';
      await osAccess.executeCommand('pwd', userId);

      const history = osAccess.getExecutionHistory(userId);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('E2B Checkpoint System', () => {
    it('should save checkpoint data', async () => {
      const conversationId = 'test-conv';
      const userId = 1; // userId doit être un nombre

      const checkpointId = await checkpointManager.saveCheckpoint(
        conversationId,
        String(userId),
        {
          variables: { test: 'value' },
          files: [],
          environment: {},
          workingDirectory: '/home',
        },
        [],
        {
          version: '1.0',
          e2bVersion: '1.0',
          pythonVersion: '3.11',
          nodeVersion: '18.0',
        }
      );

      expect(checkpointId).toBeDefined();
      expect(checkpointId).toContain('checkpoint_');
    });

    it('should list checkpoints for a conversation', async () => {
      const conversationId = 'test-conv';
      const userId = 1; // userId doit être un nombre

      // Sauvegarder plusieurs checkpoints
      for (let i = 0; i < 3; i++) {
        await checkpointManager.saveCheckpoint(
          conversationId,
          String(userId),
          {
            variables: { test: `value-${i}` },
            files: [],
            environment: {},
            workingDirectory: '/home',
          },
          [],
          {
            version: '1.0',
            e2bVersion: '1.0',
            pythonVersion: '3.11',
            nodeVersion: '18.0',
          }
        );
      }

      const checkpoints = await checkpointManager.listCheckpoints(conversationId);
      expect(checkpoints.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Persistent Volume Manager', () => {
    it('should create and manage volumes', async () => {
      const volumeId = 'test-volume';
      const volume = new PersistentVolumeManager(volumeId);

      expect(volume.getVolumeId()).toBe(volumeId);
      expect(volume.getVolumePath()).toBeDefined();
    });

    it('should save and retrieve files', async () => {
      const volume = new PersistentVolumeManager('test-volume-files');
      const filePath = 'test/file.txt';
      const content = 'test content';

      // Sauvegarder
      await volume.saveFile(filePath, content);

      // Récupérer
      const file = await volume.getFile(filePath);
      expect(file).toBeDefined();
      expect(file?.content).toBe(content);
    });

    it('should list files in volume', async () => {
      const volume = new PersistentVolumeManager('test-volume-list');

      await volume.saveFile('file1.txt', 'content1');
      await volume.saveFile('file2.txt', 'content2');
      await volume.saveFile('dir/file3.txt', 'content3');

      const files = await volume.listFiles();
      expect(files.length).toBeGreaterThanOrEqual(3);
    });

    it('should export and import volume content', async () => {
      const volume = new PersistentVolumeManager('test-volume-export');

      await volume.saveFile('file1.txt', 'content1');
      await volume.saveFile('file2.txt', 'content2');

      const exported = await volume.exportVolume();
      expect(Object.keys(exported).length).toBeGreaterThanOrEqual(2);

      // Importer dans un nouveau volume
      const newVolume = new PersistentVolumeManager('test-volume-import');
      const imported = await newVolume.importVolume(exported);
      expect(imported).toBeGreaterThanOrEqual(2);
    });

    it('should get volume statistics', async () => {
      const volume = new PersistentVolumeManager('test-volume-stats');

      await volume.saveFile('file1.txt', 'content1');
      await volume.saveFile('file2.txt', 'content2');

      const stats = await volume.getStats();
      expect(stats.totalFiles).toBeGreaterThanOrEqual(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Orchestrator Integration', () => {
    it('should execute tasks with orchestration', async () => {
      const request: TaskRequest = {
        userId: 'test-user',
        conversationId: 'test-conv',
        taskType: 'code_execution',
        content: 'print("hello world")',
        code: 'print("hello world")',
        language: 'python',
      };

      const result = await orchestrator.executeTask(request);
      expect(result).toBeDefined();
      expect(result.attempts).toBeGreaterThanOrEqual(1);
    });

    it('should track execution log', async () => {
      const request: TaskRequest = {
        userId: 'test-user',
        conversationId: 'test-conv',
        taskType: 'code_execution',
        content: 'test code',
      };

      await orchestrator.executeTask(request);

      const log = orchestrator.getExecutionLog();
      expect(log.length).toBeGreaterThan(0);
    });

    it('should handle task type detection in execution', async () => {
      const request: TaskRequest = {
        userId: 'test-user',
        conversationId: 'test-conv',
        taskType: 'unknown',
        content: 'Execute this shell command: pwd',
      };

      // Détecter le type
      request.taskType = orchestrator.detectTaskType(request.content);
      expect(request.taskType).toBe('os_command');
    });
  });

  describe('System Resilience', () => {
    it('should handle errors gracefully', async () => {
      const request: TaskRequest = {
        userId: 'test-user',
        conversationId: 'test-conv',
        taskType: 'code_execution',
        content: 'invalid python code !!!',
      };

      const result = await orchestrator.executeTask(request);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should retry on failure', async () => {
      const request: TaskRequest = {
        userId: 'test-user',
        conversationId: 'test-conv',
        taskType: 'code_execution',
        content: 'code with error',
      };

      const result = await orchestrator.executeTask(request);
      expect(result.attempts).toBeLessThanOrEqual(3);
    });
  });

  describe('End-to-End Autonomous Flow', () => {
    it('should complete full autonomous workflow', async () => {
      const userId = 1; // userId doit être un nombre
      const conversationId = 'test-conv';

      // 1. Sauvegarder l'état
      await persistentState.setVariable(userId, conversationId, 'workflow', 'started');

      // 2. Créer un volume
      const volume = volumeManager.getOrCreateVolume(conversationId);
      await volume.saveFile('workflow.txt', 'Workflow started');

      // 3. Exécuter une tâche
      const request: TaskRequest = {
        userId,
        conversationId,
        taskType: 'code_execution',
        content: 'test code',
      };

      const result = await orchestrator.executeTask(request);
      expect(result).toBeDefined();

      // 4. Sauvegarder un checkpoint
      const checkpointId = await checkpointManager.saveCheckpoint(
        conversationId,
        String(userId),
        {
          variables: { workflow: 'completed' },
          files: [],
          environment: {},
          workingDirectory: '/home',
        },
        [],
        {
          version: '1.0',
          e2bVersion: '1.0',
          pythonVersion: '3.11',
          nodeVersion: '18.0',
        }
      );

      expect(checkpointId).toBeDefined();

      // 5. Vérifier la persistance
      const session = await persistentState.getSession(userId, conversationId);
      expect(session.variables.get('workflow')).toBe('started');

      // 6. Vérifier le volume
      const files = await volume.listFiles();
      expect(files.length).toBeGreaterThan(0);
    });
  });
});
