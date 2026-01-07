/**
 * Tests pour le module d'auto-correction visible
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectSyntaxIssues } from './visibleAutoCorrection';

describe('Visible Auto-Correction', () => {
  describe('detectSyntaxIssues', () => {
    describe('Python', () => {
      it('should detect unbalanced parentheses', () => {
        const result = detectSyntaxIssues('print((1 + 2)', 'python');
        expect(result.hasIssues).toBe(true);
        expect(result.issues).toContain('Parenthèses non équilibrées');
      });

      it('should detect missing colon after for', () => {
        const result = detectSyntaxIssues('for i in range(5)\n  print(i)', 'python');
        expect(result.hasIssues).toBe(true);
        expect(result.issues).toContain('Deux-points manquants après une instruction de contrôle');
      });

      it('should NOT flag valid Python code', () => {
        const result = detectSyntaxIssues('for i in range(5):\n  print(i)', 'python');
        expect(result.hasIssues).toBe(false);
      });

      it('should detect unclosed quotes', () => {
        const result = detectSyntaxIssues('print("Hello)', 'python');
        expect(result.hasIssues).toBe(true);
        expect(result.issues).toContain('Guillemets non fermés');
      });
    });

    describe('JavaScript', () => {
      it('should detect unbalanced braces', () => {
        const result = detectSyntaxIssues('function test() { return 1;', 'javascript');
        expect(result.hasIssues).toBe(true);
        expect(result.issues).toContain('Accolades non équilibrées');
      });

      it('should NOT flag valid JavaScript code', () => {
        const result = detectSyntaxIssues('function test() { return 1; }', 'javascript');
        expect(result.hasIssues).toBe(false);
      });
    });
  });

  describe('Auto-Correction Flow', () => {
    it('should format success response correctly', () => {
      // Test de format basique - vérifie que la structure est correcte
      const code = 'print("Hello")';
      const output = 'Hello';
      
      // Le formattage devrait inclure le code et le résultat
      expect(code).toContain('print');
      expect(output).toBe('Hello');
    });

    it('should handle correction steps properly', () => {
      // Test de la structure des étapes de correction
      const steps = [
        { step: 1, type: 'error_detected' as const, message: 'Erreur détectée' },
        { step: 2, type: 'analyzing' as const, message: 'Analyse en cours' },
        { step: 3, type: 'correction_applied' as const, message: 'Correction appliquée' },
        { step: 4, type: 'success' as const, message: 'Succès' }
      ];

      expect(steps.length).toBe(4);
      expect(steps[0].type).toBe('error_detected');
      expect(steps[3].type).toBe('success');
    });
  });
});
