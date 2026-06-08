import { getPrisma } from "@/lib/prisma";
import { normalizeStoredTrackerState, type TrackerState } from "@/lib/tracker";

type TrackerSnapshotRow = {
  payload: unknown;
  updatedAt: Date | string;
};

export type PersistedTrackerSnapshot = {
  state: TrackerState;
  updatedAt: string;
};

let didEnsureTrackerTable = false;

export function isTrackerDatabaseEnabled() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function readTrackerSnapshot(clientId: string): Promise<PersistedTrackerSnapshot | null> {
  await ensureTrackerSnapshotTable();
  const prisma = getPrisma();

  const rows = await prisma.$queryRawUnsafe<TrackerSnapshotRow[]>(
    `SELECT "payload", "updatedAt" FROM "TrackerStateSnapshot" WHERE "clientId" = $1 LIMIT 1`,
    clientId
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    state: normalizeStoredTrackerState(row.payload),
    updatedAt: new Date(row.updatedAt).toISOString()
  };
}

export async function writeTrackerSnapshot(clientId: string, state: TrackerState) {
  await ensureTrackerSnapshotTable();
  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "TrackerStateSnapshot" ("clientId", "payload", "createdAt", "updatedAt")
      VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("clientId")
      DO UPDATE SET "payload" = EXCLUDED."payload", "updatedAt" = CURRENT_TIMESTAMP
    `,
    clientId,
    JSON.stringify(state)
  );

  return new Date().toISOString();
}

async function ensureTrackerSnapshotTable() {
  if (didEnsureTrackerTable) {
    return;
  }

  const prisma = getPrisma();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TrackerStateSnapshot" (
      "clientId" TEXT PRIMARY KEY,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  didEnsureTrackerTable = true;
}
