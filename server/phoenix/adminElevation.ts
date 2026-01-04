/**
 * ADMIN ELEVATION MODULE - Élévation Admin Automatique
 * 
 * Configure l'utilisateur créateur (Artur Rodrigues Adaga) en admin
 * Lève toutes les restrictions de sécurité pour le profil admin
 * Permet l'exécution de scripts système complets
 */

import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface AdminProfile {
  userId: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  privileges: {
    canExecuteCode: boolean;
    canModifySystem: boolean;
    canAccessAllData: boolean;
    canManageUsers: boolean;
    canModifyCheckpoints: boolean;
    canBrowseWeb: boolean;
    canExecuteShell: boolean;
    canAccessLogs: boolean;
  };
  createdAt: Date;
  elevatedAt: Date;
}

export class AdminElevationModule {
  private creatorEmail = 'artur@phoenixai.dev'; // À adapter selon votre email
  private creatorName = 'Artur Rodrigues Adaga';

  /**
   * Élève automatiquement l'utilisateur créateur en admin
   * Appelé une seule fois au démarrage du système
   */
  async elevateCreatorToAdmin(): Promise<{
    success: boolean;
    userId?: number;
    message: string;
  }> {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        message: 'Database not available'
      };
    }

    try {
      // Chercher l'utilisateur créateur par email ou nom
      const creatorUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, this.creatorEmail));

      if (creatorUsers.length === 0) {
        console.log('[AdminElevation] Aucun utilisateur trouvé avec l\'email:', this.creatorEmail);
        return {
          success: false,
          message: `Aucun utilisateur trouvé avec l'email ${this.creatorEmail}`
        };
      }

      const creator = creatorUsers[0];

      // Vérifier s'il est déjà admin
      if (creator.role === 'admin') {
        console.log('[AdminElevation] L\'utilisateur est déjà admin:', creator.id);
        return {
          success: true,
          userId: creator.id,
          message: `${creator.name} est déjà administrateur`
        };
      }

      // Élever en admin
      await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, creator.id));

      console.log(`[AdminElevation] ✅ ${creator.name} (ID: ${creator.id}) promu administrateur`);

      return {
        success: true,
        userId: creator.id,
        message: `${creator.name} a été promu administrateur avec tous les privilèges`
      };
    } catch (error) {
      console.error('[AdminElevation] Erreur lors de l\'élévation:', error);
      return {
        success: false,
        message: `Erreur lors de l'élévation: ${String(error)}`
      };
    }
  }

  /**
   * Récupère le profil admin complet d'un utilisateur
   */
  async getAdminProfile(userId: number): Promise<AdminProfile | null> {
    const db = await getDb();
    if (!db) return null;

    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (result.length === 0) return null;

      const user = result[0];

      return {
        userId: user.id,
        name: user.name || 'Unknown',
        email: user.email || '',
        role: user.role,
        privileges: this.getPrivilegesForRole(user.role),
        createdAt: user.createdAt,
        elevatedAt: user.updatedAt
      };
    } catch (error) {
      console.error('[AdminElevation] Erreur lors de la récupération du profil:', error);
      return null;
    }
  }

  /**
   * Détermine les privilèges basés sur le rôle
   */
  private getPrivilegesForRole(role: 'admin' | 'user'): AdminProfile['privileges'] {
    if (role === 'admin') {
      return {
        canExecuteCode: true,
        canModifySystem: true,
        canAccessAllData: true,
        canManageUsers: true,
        canModifyCheckpoints: true,
        canBrowseWeb: true,
        canExecuteShell: true,
        canAccessLogs: true
      };
    }

    // Utilisateur standard
    return {
      canExecuteCode: true,
      canModifySystem: false,
      canAccessAllData: false,
      canManageUsers: false,
      canModifyCheckpoints: false,
      canBrowseWeb: true,
      canExecuteShell: false,
      canAccessLogs: false
    };
  }

  /**
   * Vérifie si un utilisateur a un privilège spécifique
   */
  async hasPrivilege(
    userId: number,
    privilege: keyof AdminProfile['privileges']
  ): Promise<boolean> {
    const profile = await this.getAdminProfile(userId);
    if (!profile) return false;

    return profile.privileges[privilege];
  }

  /**
   * Élève un utilisateur spécifique en admin
   * Nécessite une authentification admin
   */
  async promoteUserToAdmin(
    targetUserId: number,
    requestingUserId: number
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        message: 'Database not available'
      };
    }

    try {
      // Vérifier que le demandeur est admin
      const requestingProfile = await this.getAdminProfile(requestingUserId);
      if (!requestingProfile || requestingProfile.role !== 'admin') {
        return {
          success: false,
          message: 'Seul un administrateur peut promouvoir d\'autres utilisateurs'
        };
      }

      // Promouvoir l'utilisateur
      await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, targetUserId));

      console.log(`[AdminElevation] Utilisateur ${targetUserId} promu par ${requestingUserId}`);

      return {
        success: true,
        message: `Utilisateur ${targetUserId} a été promu administrateur`
      };
    } catch (error) {
      console.error('[AdminElevation] Erreur lors de la promotion:', error);
      return {
        success: false,
        message: `Erreur lors de la promotion: ${String(error)}`
      };
    }
  }

  /**
   * Rétrograde un utilisateur admin en utilisateur standard
   */
  async demoteAdminToUser(
    targetUserId: number,
    requestingUserId: number
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        message: 'Database not available'
      };
    }

    try {
      // Vérifier que le demandeur est admin
      const requestingProfile = await this.getAdminProfile(requestingUserId);
      if (!requestingProfile || requestingProfile.role !== 'admin') {
        return {
          success: false,
          message: 'Seul un administrateur peut rétrograder d\'autres utilisateurs'
        };
      }

      // Empêcher la rétrogradation du créateur
      if (targetUserId === requestingUserId) {
        return {
          success: false,
          message: 'Impossible de se rétrograder soi-même'
        };
      }

      // Rétrograder l'utilisateur
      await db
        .update(users)
        .set({ role: 'user' })
        .where(eq(users.id, targetUserId));

      console.log(`[AdminElevation] Utilisateur ${targetUserId} rétrogradé par ${requestingUserId}`);

      return {
        success: true,
        message: `Utilisateur ${targetUserId} a été rétrogradé en utilisateur standard`
      };
    } catch (error) {
      console.error('[AdminElevation] Erreur lors de la rétrogradation:', error);
      return {
        success: false,
        message: `Erreur lors de la rétrogradation: ${String(error)}`
      };
    }
  }

  /**
   * Liste tous les administrateurs
   */
  async listAdmins(): Promise<AdminProfile[]> {
    const db = await getDb();
    if (!db) return [];

    try {
      const adminUsers = await db
        .select()
        .from(users)
        .where(eq(users.role, 'admin'));

      return adminUsers.map(user => ({
        userId: user.id,
        name: user.name || 'Unknown',
        email: user.email || '',
        role: user.role,
        privileges: this.getPrivilegesForRole(user.role),
        createdAt: user.createdAt,
        elevatedAt: user.updatedAt
      }));
    } catch (error) {
      console.error('[AdminElevation] Erreur lors de la récupération des admins:', error);
      return [];
    }
  }

  /**
   * Récupère les statistiques d'accès admin
   */
  async getAdminStatistics(): Promise<{
    totalAdmins: number;
    totalUsers: number;
    creatorStatus: 'admin' | 'user' | 'not_found';
  }> {
    const db = await getDb();
    if (!db) {
      return {
        totalAdmins: 0,
        totalUsers: 0,
        creatorStatus: 'not_found'
      };
    }

    try {
      const allUsers = await db.select().from(users);
      const adminUsers = allUsers.filter(u => u.role === 'admin');
      const creatorUser = allUsers.find(u => u.email === this.creatorEmail);

      return {
        totalAdmins: adminUsers.length,
        totalUsers: allUsers.length,
        creatorStatus: creatorUser?.role === 'admin' ? 'admin' : creatorUser ? 'user' : 'not_found'
      };
    } catch (error) {
      console.error('[AdminElevation] Erreur lors de la récupération des statistiques:', error);
      return {
        totalAdmins: 0,
        totalUsers: 0,
        creatorStatus: 'not_found'
      };
    }
  }
}

// Export singleton
export const adminElevation = new AdminElevationModule();
