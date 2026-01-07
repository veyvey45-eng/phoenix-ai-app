/**
 * Hosted Sites Service - Gestion des sites web hébergés de façon permanente
 */

import { getDb } from "./db";
import { hostedSites, type HostedSite, type InsertHostedSite } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";

function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 40);
  
  const uniqueId = nanoid(8);
  return `${baseSlug}-${uniqueId}`;
}

export async function createHostedSite(params: {
  userId: number;
  name: string;
  description?: string;
  siteType?: InsertHostedSite["siteType"];
  htmlContent: string;
  cssContent?: string;
  jsContent?: string;
  isPublic?: boolean;
}): Promise<HostedSite | null> {
  const db = await getDb();
  if (!db) return null;
  
  const slug = generateSlug(params.name);
  
  const [site] = await db.insert(hostedSites).values({
    userId: params.userId,
    slug,
    name: params.name,
    description: params.description,
    siteType: params.siteType || "custom",
    htmlContent: params.htmlContent,
    cssContent: params.cssContent,
    jsContent: params.jsContent,
    isPublic: params.isPublic ?? true,
  }).$returningId();
  
  const [createdSite] = await db
    .select()
    .from(hostedSites)
    .where(eq(hostedSites.id, site.id));
  
  return createdSite;
}

export async function getSiteBySlug(slug: string): Promise<HostedSite | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [site] = await db
    .select()
    .from(hostedSites)
    .where(eq(hostedSites.slug, slug));
  
  return site || null;
}

export async function getSiteById(id: number): Promise<HostedSite | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [site] = await db
    .select()
    .from(hostedSites)
    .where(eq(hostedSites.id, id));
  
  return site || null;
}

export async function getUserSites(userId: number): Promise<HostedSite[]> {
  const db = await getDb();
  if (!db) return [];
  
  const sites = await db
    .select()
    .from(hostedSites)
    .where(eq(hostedSites.userId, userId))
    .orderBy(desc(hostedSites.createdAt));
  
  return sites;
}

export async function updateSite(
  id: number,
  userId: number,
  updates: Partial<Pick<InsertHostedSite, "name" | "description" | "htmlContent" | "cssContent" | "jsContent" | "isPublic">>
): Promise<HostedSite | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db
    .update(hostedSites)
    .set(updates)
    .where(and(eq(hostedSites.id, id), eq(hostedSites.userId, userId)));
  
  return getSiteById(id);
}

export async function deleteSite(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db
    .delete(hostedSites)
    .where(and(eq(hostedSites.id, id), eq(hostedSites.userId, userId)));
  
  return true;
}

export async function incrementViewCount(slug: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const site = await getSiteBySlug(slug);
  if (site) {
    await db
      .update(hostedSites)
      .set({
        viewCount: (site.viewCount || 0) + 1,
        lastViewedAt: new Date(),
      })
      .where(eq(hostedSites.slug, slug));
  }
}

export async function getPublicSites(limit: number = 20): Promise<HostedSite[]> {
  const db = await getDb();
  if (!db) return [];
  
  const sites = await db
    .select()
    .from(hostedSites)
    .where(eq(hostedSites.isPublic, true))
    .orderBy(desc(hostedSites.viewCount))
    .limit(limit);
  
  return sites;
}
