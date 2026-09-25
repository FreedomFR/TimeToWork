import { prisma } from "./prisma";

/**
 * Ids of other rows a request wants to link to (an entry's project and tags, a project's client).
 * Each must belong to the caller: linking to someone else's row would let a user attach —
 * and read back, since responses embed the project and client — data they don't own.
 */
interface References {
  projectId?: string | null;
  clientId?: string | null;
  tagIds?: string[];
}

/**
 * Returns an error message when a referenced row doesn't exist or belongs to another user
 * (both are reported the same way, so ids can't be probed), or `null` when all are the caller's.
 */
export async function foreignReference(userId: string, refs: References): Promise<string | null> {
  if (refs.projectId && (await prisma.project.count({ where: { id: refs.projectId, userId } })) === 0) {
    return "Projet introuvable";
  }
  if (refs.clientId && (await prisma.client.count({ where: { id: refs.clientId, userId } })) === 0) {
    return "Client introuvable";
  }
  if (refs.tagIds && refs.tagIds.length > 0) {
    const unique = Array.from(new Set(refs.tagIds));
    if ((await prisma.tag.count({ where: { id: { in: unique }, userId } })) !== unique.length) {
      return "Balise introuvable";
    }
  }
  return null;
}
