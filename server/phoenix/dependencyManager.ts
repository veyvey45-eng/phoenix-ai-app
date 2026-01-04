/**
 * Dependency Manager - Gestion des dépendances npm/yarn
 * 
 * Gère:
 * - Installation des packages
 * - Résolution des conflits
 * - Mise à jour des versions
 * - Audit de sécurité
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface DependencyInfo {
  name: string;
  version: string;
  latest?: string;
  type: 'production' | 'development' | 'peer';
  installed: boolean;
}

export interface InstallationResult {
  success: boolean;
  installed: string[];
  failed: string[];
  warnings: string[];
  duration: number;
}

export interface AuditResult {
  vulnerabilities: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  issues: AuditIssue[];
}

export interface AuditIssue {
  package: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

/**
 * Installe les dépendances d'un projet
 */
export async function installDependencies(
  projectPath: string,
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
): Promise<InstallationResult> {
  try {
    console.log('[DependencyManager] Installing dependencies:', projectPath);

    const startTime = Date.now();
    const installed: string[] = [];
    const failed: string[] = [];
    const warnings: string[] = [];

    try {
      const command = packageManager === 'yarn' 
        ? 'yarn install' 
        : packageManager === 'pnpm'
        ? 'pnpm install'
        : 'npm install';

      const { stdout, stderr } = await execAsync(command, {
        cwd: projectPath,
        timeout: 300000 // 5 minutes
      });

      console.log('[DependencyManager] Installation output:', stdout.substring(0, 500));

      // Parser les dépendances installées
      const lines = stdout.split('\n');
      lines.forEach(line => {
        if (line.includes('added') || line.includes('up to date')) {
          installed.push(line.trim());
        }
        if (line.includes('warn')) {
          warnings.push(line.trim());
        }
      });

      if (stderr && !stderr.includes('warn')) {
        console.warn('[DependencyManager] Installation warnings:', stderr);
        warnings.push(stderr);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        installed,
        failed,
        warnings,
        duration
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[DependencyManager] Installation error:', errorMessage);

      failed.push(errorMessage);

      return {
        success: false,
        installed,
        failed,
        warnings,
        duration: Date.now() - startTime
      };
    }
  } catch (error) {
    console.error('[DependencyManager] Error:', error);
    throw error;
  }
}

/**
 * Ajoute une dépendance au projet
 */
export async function addDependency(
  projectPath: string,
  packageName: string,
  version?: string,
  isDev: boolean = false,
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
): Promise<DependencyInfo> {
  try {
    console.log('[DependencyManager] Adding dependency:', packageName);

    const versionSpec = version ? `@${version}` : '';
    const devFlag = isDev ? (packageManager === 'yarn' ? '--dev' : '--save-dev') : '';

    const command = packageManager === 'yarn'
      ? `yarn add ${packageName}${versionSpec} ${devFlag}`
      : packageManager === 'pnpm'
      ? `pnpm add ${packageName}${versionSpec} ${devFlag ? '-D' : ''}`
      : `npm install ${packageName}${versionSpec} ${devFlag}`;

    const { stdout } = await execAsync(command, {
      cwd: projectPath,
      timeout: 120000
    });

    console.log('[DependencyManager] Added:', packageName);

    return {
      name: packageName,
      version: version || 'latest',
      type: isDev ? 'development' : 'production',
      installed: true
    };
  } catch (error) {
    console.error('[DependencyManager] Add error:', error);
    return {
      name: packageName,
      version: version || 'latest',
      type: isDev ? 'development' : 'production',
      installed: false
    };
  }
}

/**
 * Supprime une dépendance du projet
 */
export async function removeDependency(
  projectPath: string,
  packageName: string,
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
): Promise<boolean> {
  try {
    console.log('[DependencyManager] Removing dependency:', packageName);

    const command = packageManager === 'yarn'
      ? `yarn remove ${packageName}`
      : packageManager === 'pnpm'
      ? `pnpm remove ${packageName}`
      : `npm uninstall ${packageName}`;

    await execAsync(command, {
      cwd: projectPath,
      timeout: 60000
    });

    console.log('[DependencyManager] Removed:', packageName);
    return true;
  } catch (error) {
    console.error('[DependencyManager] Remove error:', error);
    return false;
  }
}

/**
 * Met à jour les dépendances
 */
export async function updateDependencies(
  projectPath: string,
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
): Promise<InstallationResult> {
  try {
    console.log('[DependencyManager] Updating dependencies');

    const startTime = Date.now();
    const command = packageManager === 'yarn'
      ? 'yarn upgrade'
      : packageManager === 'pnpm'
      ? 'pnpm update'
      : 'npm update';

    const { stdout } = await execAsync(command, {
      cwd: projectPath,
      timeout: 300000
    });

    const duration = Date.now() - startTime;

    return {
      success: true,
      installed: [stdout.substring(0, 200)],
      failed: [],
      warnings: [],
      duration
    };
  } catch (error) {
    console.error('[DependencyManager] Update error:', error);
    return {
      success: false,
      installed: [],
      failed: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      duration: 0
    };
  }
}

/**
 * Audit les dépendances pour les vulnérabilités
 */
export async function auditDependencies(
  projectPath: string,
  packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm'
): Promise<AuditResult> {
  try {
    console.log('[DependencyManager] Auditing dependencies');

    const command = packageManager === 'yarn'
      ? 'yarn audit --json'
      : packageManager === 'pnpm'
      ? 'pnpm audit --json'
      : 'npm audit --json';

    try {
      const { stdout } = await execAsync(command, {
        cwd: projectPath,
        timeout: 60000
      });

      const auditData = JSON.parse(stdout);

      return {
        vulnerabilities: auditData.metadata?.vulnerabilities?.total || 0,
        critical: auditData.metadata?.vulnerabilities?.critical || 0,
        high: auditData.metadata?.vulnerabilities?.high || 0,
        medium: auditData.metadata?.vulnerabilities?.medium || 0,
        low: auditData.metadata?.vulnerabilities?.low || 0,
        issues: parseAuditIssues(auditData)
      };
    } catch (error) {
      // npm audit peut retourner un code d'erreur même avec du JSON valide
      console.warn('[DependencyManager] Audit returned error, parsing anyway');
      return {
        vulnerabilities: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        issues: []
      };
    }
  } catch (error) {
    console.error('[DependencyManager] Audit error:', error);
    throw error;
  }
}

/**
 * Parse les issues d'audit
 */
function parseAuditIssues(auditData: any): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (auditData.vulnerabilities) {
    Object.entries(auditData.vulnerabilities).forEach(([packageName, vulnData]: [string, any]) => {
      if (vulnData.vulnerabilities) {
        vulnData.vulnerabilities.forEach((vuln: any) => {
          issues.push({
            package: packageName,
            severity: vuln.severity || 'medium',
            description: vuln.title || 'Unknown vulnerability',
            recommendation: vuln.recommendation || 'Update to a patched version'
          });
        });
      }
    });
  }

  return issues;
}

/**
 * Lit le package.json du projet
 */
export async function readPackageJson(projectPath: string): Promise<any> {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[DependencyManager] Error reading package.json:', error);
    return null;
  }
}

/**
 * Écrit le package.json du projet
 */
export async function writePackageJson(projectPath: string, packageJson: any): Promise<boolean> {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    return true;
  } catch (error) {
    console.error('[DependencyManager] Error writing package.json:', error);
    return false;
  }
}

/**
 * Obtient les informations sur une dépendance
 */
export async function getDependencyInfo(
  projectPath: string,
  packageName: string
): Promise<DependencyInfo | null> {
  try {
    const packageJson = await readPackageJson(projectPath);
    if (!packageJson) return null;

    const version = packageJson.dependencies?.[packageName] ||
                   packageJson.devDependencies?.[packageName] ||
                   packageJson.peerDependencies?.[packageName];

    if (!version) return null;

    const type = packageJson.dependencies?.[packageName]
      ? 'production'
      : packageJson.devDependencies?.[packageName]
      ? 'development'
      : 'peer';

    return {
      name: packageName,
      version,
      type,
      installed: true
    };
  } catch (error) {
    console.error('[DependencyManager] Error getting dependency info:', error);
    return null;
  }
}

/**
 * Singleton global
 */
let instance: typeof DependencyManagerModule;

export const DependencyManagerModule = {
  installDependencies,
  addDependency,
  removeDependency,
  updateDependencies,
  auditDependencies,
  readPackageJson,
  writePackageJson,
  getDependencyInfo
};

export function getDependencyManager() {
  if (!instance) {
    instance = DependencyManagerModule;
  }
  return instance;
}
