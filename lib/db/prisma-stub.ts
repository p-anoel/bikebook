/**
 * Prisma stub for v2 — no database in MVP.
 * Uncomment and run `npx prisma init` when adding persistence.
 */

export interface UserRecord {
  id: string;
  email: string;
  createdAt: Date;
}

export interface RoadbookRecord {
  id: string;
  userId: string;
  name: string;
  gpxContent: string;
  createdAt: Date;
  updatedAt: Date;
}

// export const prisma = new PrismaClient();
