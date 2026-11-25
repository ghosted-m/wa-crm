// server/_core/index.ts
import "dotenv/config";
import fs5 from "node:fs";
import path5 from "node:path";
import express2 from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "webdev_app_session";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import Database from "better-sqlite3";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";

// drizzle/schema.ts
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";
var users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
});
var instagramAccounts = sqliteTable(
  "instagram_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerOpenId: text("ownerOpenId").notNull().references(() => users.openId, { onDelete: "cascade" }),
    instagramUserId: text("instagramUserId").notNull(),
    username: text("username").notNull(),
    name: text("name"),
    accountType: text("accountType").notNull(),
    profilePictureUrl: text("profilePictureUrl"),
    followersCount: integer("followersCount").default(0).notNull(),
    mediaCount: integer("mediaCount").default(0).notNull(),
    encryptedAccessToken: text("encryptedAccessToken").notNull(),
    tokenExpiresAt: integer("tokenExpiresAt", { mode: "timestamp" }),
    grantedScopes: text("grantedScopes"),
    createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
  },
  (table) => [
    uniqueIndex("instagram_accounts_owner_ig_unique").on(
      table.ownerOpenId,
      table.instagramUserId
    ),
    index("instagram_accounts_owner_idx").on(table.ownerOpenId)
  ]
);
var instagramOAuthStates = sqliteTable(
  "instagram_oauth_states",
  {
    stateHash: text("stateHash").primaryKey(),
    ownerOpenId: text("ownerOpenId").notNull().references(() => users.openId, { onDelete: "cascade" }),
    callbackUri: text("callbackUri").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
  },
  (table) => [
    index("instagram_oauth_states_expiry_idx").on(table.expiresAt),
    index("instagram_oauth_states_owner_idx").on(table.ownerOpenId)
  ]
);
var facebookAccounts = sqliteTable(
  "facebook_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerOpenId: text("ownerOpenId").notNull().references(() => users.openId, { onDelete: "cascade" }),
    pageId: text("pageId").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    profilePictureUrl: text("profilePictureUrl"),
    followersCount: integer("followersCount").default(0).notNull(),
    mediaCount: integer("mediaCount").default(0).notNull(),
    encryptedAccessToken: text("encryptedAccessToken").notNull(),
    tokenExpiresAt: integer("tokenExpiresAt", { mode: "timestamp" }),
    grantedScopes: text("grantedScopes"),
    createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
  },
  (table) => [
    uniqueIndex("facebook_accounts_owner_page_unique").on(
      table.ownerOpenId,
      table.pageId
    ),
    index("facebook_accounts_owner_idx").on(table.ownerOpenId)
  ]
);
var facebookOAuthStates = sqliteTable(
  "facebook_oauth_states",
  {
    stateHash: text("stateHash").primaryKey(),
    ownerOpenId: text("ownerOpenId").notNull().references(() => users.openId, { onDelete: "cascade" }),
    callbackUri: text("callbackUri").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
  },
  (table) => [
    index("facebook_oauth_states_expiry_idx").on(table.expiresAt),
    index("facebook_oauth_states_owner_idx").on(table.ownerOpenId)
  ]
);
var instagramMediaUploads = sqliteTable(
  "instagram_media_uploads",
  {
    id: text("id").primaryKey(),
    ownerOpenId: text("ownerOpenId").notNull().references(() => users.openId, { onDelete: "cascade" }),
    storageKey: text("storageKey").notNull().unique(),
    format: text("format", { enum: ["post", "reel"] }).notNull(),
    contentType: text("contentType").notNull(),
    sizeBytes: integer("sizeBytes").notNull(),
    status: text("status", { enum: ["pending", "ready", "used"] }).default("pending").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
  },
  (table) => [
    index("instagram_uploads_owner_idx").on(table.ownerOpenId),
    index("instagram_uploads_expiry_idx").on(table.expiresAt)
  ]
);
var instagramPublishJobs = sqliteTable(
  "instagram_publish_jobs",
  {
    id: text("id").primaryKey(),
    ownerOpenId: text("ownerOpenId").notNull().references(() => users.openId, { onDelete: "cascade" }),
    uploadId: text("uploadId").notNull().references(() => instagramMediaUploads.id),
    format: text("format", { enum: ["post", "reel"] }).notNull(),
    caption: text("caption").notNull(),
    status: text("status", {
      enum: ["queued", "processing", "completed", "partial", "failed"]
    }).default("queued").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
  },
  (table) => [
    index("instagram_publish_jobs_owner_created_idx").on(
      table.ownerOpenId,
      table.createdAt
    ),
    index("instagram_publish_jobs_status_idx").on(table.status)
  ]
);
var instagramPublishTargets = sqliteTable(
  "instagram_publish_targets",
  {
    id: text("id").primaryKey(),
    jobId: text("jobId").notNull().references(() => instagramPublishJobs.id, { onDelete: "cascade" }),
    instagramAccountId: integer("instagramAccountId").references(
      () => instagramAccounts.id,
      { onDelete: "set null" }
    ),
    facebookAccountId: integer("facebookAccountId").references(
      () => facebookAccounts.id,
      { onDelete: "set null" }
    ),
    platform: text("platform", { enum: ["instagram", "facebook"] }).default("instagram"),
    username: text("username").notNull(),
    status: text("status", {
      enum: ["queued", "processing", "publishing", "published", "failed"]
    }).default("queued").notNull(),
    containerId: text("containerId"),
    instagramMediaId: text("instagramMediaId"),
    permalink: text("permalink"),
    errorMessage: text("errorMessage"),
    createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => /* @__PURE__ */ new Date()).notNull()
  },
  (table) => [
    uniqueIndex("instagram_publish_targets_job_account_unique").on(
      table.jobId,
      table.instagramAccountId
    ),
    index("instagram_publish_targets_job_idx").on(table.jobId),
    index("instagram_publish_targets_status_idx").on(table.status)
  ]
);

// server/_core/env.ts
var ENV = {
  get appId() {
    return process.env.MANUS_PROJECT_ID ?? "";
  },
  get cookieSecret() {
    return process.env.MANUS_JWT_SECRET ?? "";
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get oAuthServerUrl() {
    return process.env.MANUS_OAUTH_API_URL ?? "";
  },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() {
    return process.env.OWNER_OPEN_ID ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get forgeApiUrl() {
    return process.env.MANUS_API_URL ?? "";
  },
  get forgeApiKey() {
    return process.env.MANUS_API_KEY ?? "";
  }
};

// server/db.ts
var _db = null;
var _sqlite = null;
function initTables(sqlite) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      lastSignedIn INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instagram_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ownerOpenId TEXT NOT NULL REFERENCES users(openId) ON DELETE CASCADE,
      instagramUserId TEXT NOT NULL,
      username TEXT NOT NULL,
      name TEXT,
      accountType TEXT NOT NULL,
      profilePictureUrl TEXT,
      followersCount INTEGER NOT NULL DEFAULT 0,
      mediaCount INTEGER NOT NULL DEFAULT 0,
      encryptedAccessToken TEXT NOT NULL,
      tokenExpiresAt INTEGER,
      grantedScopes TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(ownerOpenId, instagramUserId)
    );

    CREATE TABLE IF NOT EXISTS instagram_oauth_states (
      stateHash TEXT PRIMARY KEY,
      ownerOpenId TEXT NOT NULL REFERENCES users(openId) ON DELETE CASCADE,
      callbackUri TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS facebook_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ownerOpenId TEXT NOT NULL REFERENCES users(openId) ON DELETE CASCADE,
      pageId TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      profilePictureUrl TEXT,
      followersCount INTEGER NOT NULL DEFAULT 0,
      mediaCount INTEGER NOT NULL DEFAULT 0,
      encryptedAccessToken TEXT NOT NULL,
      tokenExpiresAt INTEGER,
      grantedScopes TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(ownerOpenId, pageId)
    );

    CREATE TABLE IF NOT EXISTS facebook_oauth_states (
      stateHash TEXT PRIMARY KEY,
      ownerOpenId TEXT NOT NULL REFERENCES users(openId) ON DELETE CASCADE,
      callbackUri TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instagram_media_uploads (
      id TEXT PRIMARY KEY,
      ownerOpenId TEXT NOT NULL REFERENCES users(openId) ON DELETE CASCADE,
      storageKey TEXT NOT NULL UNIQUE,
      format TEXT NOT NULL,
      contentType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instagram_publish_jobs (
      id TEXT PRIMARY KEY,
      ownerOpenId TEXT NOT NULL REFERENCES users(openId) ON DELETE CASCADE,
      uploadId TEXT NOT NULL REFERENCES instagram_media_uploads(id),
      format TEXT NOT NULL,
      caption TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instagram_publish_targets (
      id TEXT PRIMARY KEY,
      jobId TEXT NOT NULL REFERENCES instagram_publish_jobs(id) ON DELETE CASCADE,
      instagramAccountId INTEGER REFERENCES instagram_accounts(id) ON DELETE SET NULL,
      username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      containerId TEXT,
      instagramMediaId TEXT,
      permalink TEXT,
      errorMessage TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      UNIQUE(jobId, instagramAccountId)
    );
  `);
  try {
    sqlite.exec(`ALTER TABLE facebook_accounts ADD COLUMN mediaCount INTEGER NOT NULL DEFAULT 0;`);
  } catch {
  }
  try {
    sqlite.exec(`ALTER TABLE instagram_publish_targets ADD COLUMN platform TEXT DEFAULT 'instagram';`);
  } catch {
  }
  try {
    sqlite.exec(`ALTER TABLE instagram_publish_targets ADD COLUMN facebookAccountId INTEGER REFERENCES facebook_accounts(id) ON DELETE SET NULL;`);
  } catch {
  }
}
async function getDb() {
  if (!_db) {
    const rawUrl = process.env.DATABASE_URL || "./instadesk.db";
    const dbPath = rawUrl.replace(/^sqlite:\/\//, "");
    try {
      _sqlite = new Database(dbPath);
      _sqlite.pragma("journal_mode = WAL");
      _sqlite.pragma("foreign_keys = ON");
      initTables(_sqlite);
      _db = drizzle(_sqlite);
    } catch (error) {
      console.warn("[Database] Failed to connect to SQLite:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function upsertInstagramAccount(account) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(instagramAccounts).values(account).onConflictDoUpdate({
    target: [instagramAccounts.ownerOpenId, instagramAccounts.instagramUserId],
    set: {
      username: account.username,
      name: account.name,
      accountType: account.accountType,
      profilePictureUrl: account.profilePictureUrl,
      followersCount: account.followersCount,
      mediaCount: account.mediaCount,
      encryptedAccessToken: account.encryptedAccessToken,
      tokenExpiresAt: account.tokenExpiresAt,
      grantedScopes: account.grantedScopes,
      updatedAt: /* @__PURE__ */ new Date()
    }
  });
}
async function getInstagramAccountsForUser(ownerOpenId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({
    id: instagramAccounts.id,
    instagramUserId: instagramAccounts.instagramUserId,
    username: instagramAccounts.username,
    name: instagramAccounts.name,
    accountType: instagramAccounts.accountType,
    profilePictureUrl: instagramAccounts.profilePictureUrl,
    followersCount: instagramAccounts.followersCount,
    mediaCount: instagramAccounts.mediaCount,
    tokenExpiresAt: instagramAccounts.tokenExpiresAt,
    createdAt: instagramAccounts.createdAt
  }).from(instagramAccounts).where(eq(instagramAccounts.ownerOpenId, ownerOpenId)).orderBy(desc(instagramAccounts.createdAt));
}
async function deleteInstagramAccountForUser(ownerOpenId, id) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.delete(instagramAccounts).where(
    and(
      eq(instagramAccounts.ownerOpenId, ownerOpenId),
      eq(instagramAccounts.id, id)
    )
  );
}
async function createInstagramOAuthTransaction(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(instagramOAuthStates).where(lte(instagramOAuthStates.expiresAt, /* @__PURE__ */ new Date()));
  await db.insert(instagramOAuthStates).values(input);
}
async function consumeInstagramOAuthTransaction(stateHash) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction((tx) => {
    const [transaction] = tx.select().from(instagramOAuthStates).where(eq(instagramOAuthStates.stateHash, stateHash)).limit(1).all();
    if (!transaction) return null;
    tx.delete(instagramOAuthStates).where(eq(instagramOAuthStates.stateHash, stateHash)).run();
    if (transaction.expiresAt.getTime() <= Date.now()) return null;
    return transaction;
  });
}
async function getInstagramAccountForUser(ownerOpenId, id) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [account] = await db.select().from(instagramAccounts).where(
    and(
      eq(instagramAccounts.ownerOpenId, ownerOpenId),
      eq(instagramAccounts.id, id)
    )
  ).limit(1);
  return account ?? null;
}
async function updateInstagramAccountToken(ownerOpenId, id, encryptedAccessToken, tokenExpiresAt) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.update(instagramAccounts).set({ encryptedAccessToken, tokenExpiresAt, updatedAt: /* @__PURE__ */ new Date() }).where(
    and(
      eq(instagramAccounts.ownerOpenId, ownerOpenId),
      eq(instagramAccounts.id, id)
    )
  );
}
async function updateInstagramAccountCounts(ownerOpenId, id, followersCount, mediaCount) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(instagramAccounts).set({ followersCount, mediaCount, updatedAt: /* @__PURE__ */ new Date() }).where(
    and(
      eq(instagramAccounts.ownerOpenId, ownerOpenId),
      eq(instagramAccounts.id, id)
    )
  );
}
async function createInstagramMediaUpload(upload) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(instagramMediaUploads).values(upload);
}
async function getInstagramMediaUploadForUser(ownerOpenId, id) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [upload] = await db.select().from(instagramMediaUploads).where(
    and(
      eq(instagramMediaUploads.ownerOpenId, ownerOpenId),
      eq(instagramMediaUploads.id, id)
    )
  ).limit(1);
  return upload ?? null;
}
async function markInstagramMediaUploadReady(ownerOpenId, id) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(instagramMediaUploads).set({ status: "ready" }).where(
    and(
      eq(instagramMediaUploads.ownerOpenId, ownerOpenId),
      eq(instagramMediaUploads.id, id),
      eq(instagramMediaUploads.status, "pending")
    )
  );
}
async function createInstagramPublishJob(job) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  db.transaction((tx) => {
    const [upload] = tx.select().from(instagramMediaUploads).where(
      and(
        eq(instagramMediaUploads.ownerOpenId, job.ownerOpenId),
        eq(instagramMediaUploads.id, job.uploadId)
      )
    ).limit(1).all();
    if (!upload || upload.status !== "ready" || upload.expiresAt.getTime() <= Date.now()) {
      throw new Error("The uploaded media is not ready or has expired.");
    }
    if (upload.format !== job.format) {
      throw new Error("The media format does not match the composer.");
    }
    tx.insert(instagramPublishJobs).values({
      id: job.id,
      ownerOpenId: job.ownerOpenId,
      uploadId: job.uploadId,
      format: job.format,
      caption: job.caption,
      status: "queued"
    }).run();
    tx.insert(instagramPublishTargets).values(
      job.targets.map((target) => ({
        id: target.id,
        jobId: job.id,
        instagramAccountId: target.instagramAccountId ?? null,
        facebookAccountId: target.facebookAccountId ?? null,
        platform: target.platform ?? (target.facebookAccountId ? "facebook" : "instagram"),
        username: target.username,
        status: "queued"
      }))
    ).run();
    tx.update(instagramMediaUploads).set({ status: "used" }).where(eq(instagramMediaUploads.id, job.uploadId)).run();
  });
}
async function updateInstagramPublishTarget(jobId, targetId, patch) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(instagramPublishTargets).set({ ...patch, updatedAt: /* @__PURE__ */ new Date() }).where(
    and(
      eq(instagramPublishTargets.jobId, jobId),
      eq(instagramPublishTargets.id, targetId)
    )
  );
}
async function claimInstagramPublishTarget(jobId, targetId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.update(instagramPublishTargets).set({ status: "publishing", updatedAt: /* @__PURE__ */ new Date() }).where(
    and(
      eq(instagramPublishTargets.jobId, jobId),
      eq(instagramPublishTargets.id, targetId),
      eq(instagramPublishTargets.status, "processing")
    )
  );
  const changes = result?.changes ?? result?.[0]?.affectedRows ?? 0;
  return changes > 0;
}
async function updateInstagramPublishJobStatus(ownerOpenId, jobId, status) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(instagramPublishJobs).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(
    and(
      eq(instagramPublishJobs.ownerOpenId, ownerOpenId),
      eq(instagramPublishJobs.id, jobId)
    )
  );
}
async function getInstagramPublishJobForUser(ownerOpenId, jobId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [job] = await db.select().from(instagramPublishJobs).where(
    and(
      eq(instagramPublishJobs.ownerOpenId, ownerOpenId),
      eq(instagramPublishJobs.id, jobId)
    )
  ).limit(1);
  if (!job) return null;
  const targets = await db.select().from(instagramPublishTargets).where(eq(instagramPublishTargets.jobId, jobId)).orderBy(desc(instagramPublishTargets.createdAt));
  return { ...job, targets };
}
async function getInstagramPublishHistoryForUser(ownerOpenId, limit = 40) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const jobs = await db.select().from(instagramPublishJobs).where(eq(instagramPublishJobs.ownerOpenId, ownerOpenId)).orderBy(desc(instagramPublishJobs.createdAt)).limit(limit);
  if (!jobs.length) return [];
  const targets = await db.select().from(instagramPublishTargets).where(
    inArray(
      instagramPublishTargets.jobId,
      jobs.map((job) => job.id)
    )
  ).orderBy(desc(instagramPublishTargets.createdAt));
  const targetsByJob = /* @__PURE__ */ new Map();
  for (const target of targets) {
    const current = targetsByJob.get(target.jobId) ?? [];
    current.push(target);
    targetsByJob.set(target.jobId, current);
  }
  return jobs.map((job) => ({
    ...job,
    targets: targetsByJob.get(job.id) ?? []
  }));
}
async function listFacebookAccountsForUser(ownerOpenId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(facebookAccounts).where(eq(facebookAccounts.ownerOpenId, ownerOpenId)).orderBy(desc(facebookAccounts.createdAt));
}
async function getFacebookAccountForUser(ownerOpenId, accountId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [account] = await db.select().from(facebookAccounts).where(
    and(
      eq(facebookAccounts.ownerOpenId, ownerOpenId),
      eq(facebookAccounts.id, accountId)
    )
  ).limit(1);
  return account ?? null;
}
async function upsertFacebookAccount(ownerOpenId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [existing] = await db.select().from(facebookAccounts).where(
    and(
      eq(facebookAccounts.ownerOpenId, ownerOpenId),
      eq(facebookAccounts.pageId, data.pageId)
    )
  ).limit(1);
  const now = /* @__PURE__ */ new Date();
  if (existing) {
    await db.update(facebookAccounts).set({
      name: data.name,
      category: data.category ?? existing.category,
      profilePictureUrl: data.profilePictureUrl ?? existing.profilePictureUrl,
      followersCount: data.followersCount ?? existing.followersCount,
      mediaCount: data.mediaCount ?? existing.mediaCount,
      encryptedAccessToken: data.encryptedAccessToken,
      tokenExpiresAt: data.tokenExpiresAt ?? existing.tokenExpiresAt,
      grantedScopes: data.grantedScopes ?? existing.grantedScopes,
      updatedAt: now
    }).where(eq(facebookAccounts.id, existing.id));
    return { ...existing, ...data, updatedAt: now };
  }
  const [inserted] = await db.insert(facebookAccounts).values({
    ownerOpenId,
    pageId: data.pageId,
    name: data.name,
    category: data.category ?? null,
    profilePictureUrl: data.profilePictureUrl ?? null,
    followersCount: data.followersCount ?? 0,
    mediaCount: data.mediaCount ?? 0,
    encryptedAccessToken: data.encryptedAccessToken,
    tokenExpiresAt: data.tokenExpiresAt ?? null,
    grantedScopes: data.grantedScopes ?? null,
    createdAt: now,
    updatedAt: now
  }).returning();
  return inserted;
}
async function updateFacebookAccountMediaCount(accountId, mediaCount) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(facebookAccounts).set({ mediaCount, updatedAt: /* @__PURE__ */ new Date() }).where(eq(facebookAccounts.id, accountId));
}
async function decrementFacebookAccountMediaCount(accountId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [account] = await db.select({ mediaCount: facebookAccounts.mediaCount }).from(facebookAccounts).where(eq(facebookAccounts.id, accountId)).limit(1);
  if (account) {
    const newCount = Math.max(0, account.mediaCount - 1);
    await db.update(facebookAccounts).set({ mediaCount: newCount, updatedAt: /* @__PURE__ */ new Date() }).where(eq(facebookAccounts.id, accountId));
  }
}
async function decrementInstagramAccountMediaCount(accountId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [account] = await db.select({ mediaCount: instagramAccounts.mediaCount }).from(instagramAccounts).where(eq(instagramAccounts.id, accountId)).limit(1);
  if (account) {
    const newCount = Math.max(0, account.mediaCount - 1);
    await db.update(instagramAccounts).set({ mediaCount: newCount, updatedAt: /* @__PURE__ */ new Date() }).where(eq(instagramAccounts.id, accountId));
  }
}
async function deleteFacebookAccount(ownerOpenId, accountId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(facebookAccounts).where(
    and(
      eq(facebookAccounts.ownerOpenId, ownerOpenId),
      eq(facebookAccounts.id, accountId)
    )
  );
}
async function createFacebookOAuthTransaction(data) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(facebookOAuthStates).values(data);
}
async function consumeFacebookOAuthTransaction(stateHash) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [transaction] = await db.select().from(facebookOAuthStates).where(eq(facebookOAuthStates.stateHash, stateHash)).limit(1);
  if (!transaction) return null;
  await db.delete(facebookOAuthStates).where(eq(facebookOAuthStates.stateHash, stateHash));
  if (transaction.expiresAt.getTime() <= Date.now()) return null;
  return transaction;
}

// server/_core/cookies.ts
function getSessionCookieOptions(_req) {
  return { httpOnly: true, path: "/", sameSite: "none", secure: true };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: MANUS_OAUTH_API_URL is not configured! Set MANUS_OAUTH_API_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) throw new Error("MANUS_JWT_SECRET is unavailable");
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || (!isNonEmptyString(appId) || appId !== ENV.appId) || typeof name !== "string") {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken && req.path.startsWith("/api/scheduled/")) {
      const ticket = cookies.get("app_session_id");
      const identity = await this.verifySession(ticket);
      if (identity?.openId.startsWith(CRON_OPEN_ID_PREFIX)) sessionToken = ticket;
    }
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/instagram.ts
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes
} from "node:crypto";
import { TRPCError as TRPCError2 } from "@trpc/server";
import { z } from "zod";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/instagram.ts
var INSTAGRAM_CALLBACK_PATH = "/api/instagram/callback";
var INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights"
];
var GRAPH_API_VERSION = "v27.0";
var OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1e3;
function metaCredentials() {
  return {
    appId: process.env.META_INSTAGRAM_APP_ID?.trim() ?? "",
    appSecret: process.env.META_INSTAGRAM_APP_SECRET ?? ""
  };
}
function isInstagramConfigured() {
  const { appId, appSecret } = metaCredentials();
  return /^\d+$/.test(appId) && appSecret.length > 0;
}
function buildInstagramCallbackUri(origin) {
  const targetOrigin = process.env.APP_URL?.trim() || origin;
  let parsed;
  try {
    parsed = new URL(targetOrigin);
  } catch {
    throw new Error("A valid application origin is required.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !["", "/"].includes(parsed.pathname) || parsed.search || parsed.hash) {
    throw new Error(
      "Instagram OAuth requires the exact HTTPS application origin."
    );
  }
  return new URL(INSTAGRAM_CALLBACK_PATH, parsed.origin).toString();
}
function hashInstagramOAuthState(state) {
  return createHash("sha256").update(state, "utf8").digest("hex");
}
function tokenEncryptionKey(appSecret) {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(appSecret, "utf8"),
      Buffer.from("instadesk-meta-instagram-token-v1", "utf8"),
      Buffer.from("AES-256-GCM account token encryption", "utf8"),
      32
    )
  );
}
function encryptInstagramToken(token, appSecret) {
  if (!token || !appSecret)
    throw new Error("Token and encryption secret are required.");
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    tokenEncryptionKey(appSecret),
    iv
  );
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}
function decryptInstagramToken(encrypted, appSecret) {
  const [version, ivPart, tagPart, ciphertextPart] = encrypted.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart || !appSecret) {
    throw new Error("Stored Instagram token has an unsupported format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    tokenEncryptionKey(appSecret),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
function makeAuthorizeUrl(appId, callbackUri, state) {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", callbackUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}
async function beginInstagramLogin(origin, openId) {
  const { appId, appSecret } = metaCredentials();
  if (!/^\d+$/.test(appId) || !appSecret) {
    throw new TRPCError2({
      code: "PRECONDITION_FAILED",
      message: "Meta Instagram App ID and App Secret are not configured yet."
    });
  }
  let callbackUri;
  try {
    callbackUri = buildInstagramCallbackUri(origin);
  } catch (error) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Invalid application origin."
    });
  }
  const state = randomBytes(32).toString("hex");
  const now = Date.now();
  try {
    await createInstagramOAuthTransaction({
      stateHash: hashInstagramOAuthState(state),
      ownerOpenId: openId,
      callbackUri,
      expiresAt: new Date(now + OAUTH_STATE_MAX_AGE_MS)
    });
  } catch {
    throw new TRPCError2({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not start Instagram Login. Check database availability and try again."
    });
  }
  return {
    authorizeUrl: makeAuthorizeUrl(appId, callbackUri, state),
    callbackUri
  };
}
function safeStatus(origin) {
  let callbackUri = null;
  try {
    callbackUri = buildInstagramCallbackUri(origin);
  } catch {
  }
  return { configured: isInstagramConfigured(), callbackUri };
}
function stringParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function callbackResultUrl(callbackUri, result) {
  const url = new URL("/", new URL(callbackUri).origin);
  url.searchParams.set("instagram", result);
  return url.toString();
}
function sendPopupResult(res, callbackUri, result, detail) {
  const origin = JSON.stringify(new URL(callbackUri).origin);
  const fallbackUrl = JSON.stringify(callbackResultUrl(callbackUri, result));
  const resultLiteral = JSON.stringify(result);
  const detailLiteral = JSON.stringify(detail ?? "").replace(/</g, "\\u003c");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instagram authorization</title></head>
<body><p>Returning to InstaDesk\u2026</p><script>
(function(){
  var result=${resultLiteral};
  if(window.opener && !window.opener.closed){
    window.opener.postMessage({source:"instadesk:instagram-oauth",result:result,detail:${detailLiteral}},${origin});
    window.close();
  } else {
    window.location.replace(${fallbackUrl});
  }
})();
</script></body></html>`);
}
function sanitizedMetaMessage(message, secrets) {
  if (typeof message !== "string" || !message.trim()) return "";
  let safe = message;
  for (const secret of secrets) {
    if (secret.length >= 4) safe = safe.split(secret).join("[redacted]");
  }
  return safe.replace(/[\r\n\t]+/g, " ").slice(0, 240).trim();
}
async function readMetaJson(response, secrets = []) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(
        `Instagram rejected the authorization (HTTP ${response.status}).`
      );
    }
    throw new Error("Instagram returned an unreadable authorization response.");
  }
  const errorValue = data && typeof data === "object" ? data.error : void 0;
  const errorObject = errorValue && typeof errorValue === "object" ? errorValue : null;
  const errorMessage = sanitizedMetaMessage(
    errorObject?.message ?? data?.error_message ?? data?.error_description ?? data?.message,
    secrets
  );
  if (!response.ok || errorValue) {
    throw new Error(
      errorMessage ? `Instagram rejected the authorization (HTTP ${response.status}): ${errorMessage}` : `Instagram rejected the authorization (HTTP ${response.status}).`
    );
  }
  return data;
}
function tokenFromResponse(data) {
  const tokenEntry = Array.isArray(data.data) ? data.data[0] : data;
  const accessToken = tokenEntry?.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("Instagram did not return an access token.");
  }
  return {
    accessToken,
    userId: tokenEntry?.user_id == null ? void 0 : String(tokenEntry.user_id),
    permissions: tokenEntry?.permissions,
    expiresIn: typeof data.expires_in === "number" ? data.expires_in : null
  };
}
async function exchangeForShortLivedToken(code, callbackUri, appId, appSecret) {
  const form = new FormData();
  form.set("client_id", appId);
  form.set("client_secret", appSecret);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", callbackUri);
  form.set("code", code);
  const response = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(2e4)
  });
  return tokenFromResponse(
    await readMetaJson(response, [code, appId, appSecret])
  );
}
async function exchangeForLongLivedToken(shortToken, appSecret) {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortToken);
  let response = await fetch(url, { signal: AbortSignal.timeout(2e4) });
  if (!response.ok) {
    try {
      const form = new URLSearchParams();
      form.set("grant_type", "ig_exchange_token");
      form.set("client_secret", appSecret);
      form.set("access_token", shortToken);
      const postResponse = await fetch("https://graph.instagram.com/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(2e4)
      });
      if (postResponse.ok) {
        response = postResponse;
      }
    } catch {
    }
  }
  const data = await readMetaJson(response, [
    shortToken,
    appSecret
  ]);
  return tokenFromResponse(data);
}
async function fetchInstagramProfile(accessToken) {
  const url = new URL(`https://graph.instagram.com/${GRAPH_API_VERSION}/me`);
  url.searchParams.set(
    "fields",
    "user_id,username,name,account_type,profile_picture_url,followers_count,media_count"
  );
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, { signal: AbortSignal.timeout(2e4) });
  const data = await readMetaJson(response, [accessToken]);
  return Array.isArray(data.data) ? data.data[0] ?? {} : data;
}
function hasRequiredScopes(value) {
  const scopes = new Set(
    (Array.isArray(value) ? value.join(",") : value ?? "").split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean)
  );
  return INSTAGRAM_SCOPES.every((scope) => scopes.has(scope));
}
var instagramRouter = router({
  status: publicProcedure.input(z.object({ origin: z.string().url() })).query(({ input }) => safeStatus(input.origin)),
  beginLogin: protectedProcedure.input(z.object({ origin: z.string().url() })).mutation(
    ({ ctx, input }) => beginInstagramLogin(input.origin, ctx.user.openId)
  ),
  accounts: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getInstagramAccountsForUser(ctx.user.openId);
    } catch {
      throw new TRPCError2({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not load connected Instagram accounts."
      });
    }
  }),
  disconnect: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      await deleteInstagramAccountForUser(ctx.user.openId, input.id);
      return { success: true };
    } catch {
      throw new TRPCError2({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not disconnect this Instagram account."
      });
    }
  })
});
function registerInstagramOAuthCallback(app) {
  app.get(
    INSTAGRAM_CALLBACK_PATH,
    async (req, res) => {
      const state = stringParam(req, "state");
      if (!state || !/^[a-f0-9]{64}$/.test(state)) {
        res.status(400).type("text/plain").send(
          "Instagram authorization could not be verified. Start again from InstaDesk."
        );
        return;
      }
      let transaction;
      try {
        transaction = await consumeInstagramOAuthTransaction(
          hashInstagramOAuthState(state)
        );
      } catch (err) {
        console.error(
          "[Instagram] consumeInstagramOAuthTransaction failed:",
          err
        );
        res.status(503).type("text/plain").send(
          "Instagram authorization is temporarily unavailable. Start again from InstaDesk."
        );
        return;
      }
      if (!transaction) {
        res.status(400).type("text/plain").send(
          "Instagram authorization expired or was already used. Start again from InstaDesk."
        );
        return;
      }
      let expectedCallback;
      try {
        expectedCallback = buildInstagramCallbackUri(
          new URL(transaction.callbackUri).origin
        );
      } catch {
        res.status(400).type("text/plain").send("The saved Instagram callback URL is invalid.");
        return;
      }
      if (expectedCallback !== transaction.callbackUri) {
        res.status(400).type("text/plain").send("The saved Instagram callback URL is invalid.");
        return;
      }
      if (stringParam(req, "error")) {
        sendPopupResult(res, transaction.callbackUri, "cancelled");
        return;
      }
      const code = stringParam(req, "code");
      if (!code) {
        sendPopupResult(res, transaction.callbackUri, "error");
        return;
      }
      let stage = "checking Meta app configuration";
      try {
        const { appId, appSecret } = metaCredentials();
        if (!/^\d+$/.test(appId) || !appSecret) {
          throw new Error("Meta Instagram App credentials are not configured.");
        }
        stage = "exchanging the Instagram authorization code";
        const shortToken = await exchangeForShortLivedToken(
          code,
          transaction.callbackUri,
          appId,
          appSecret
        );
        stage = "checking granted Instagram permissions";
        if (!hasRequiredScopes(shortToken.permissions)) {
          throw new Error("Required Instagram permissions were not granted.");
        }
        stage = "extending the Instagram access token";
        let longToken = shortToken;
        try {
          longToken = await exchangeForLongLivedToken(
            shortToken.accessToken,
            appSecret
          );
        } catch (tokenErr) {
          console.warn(
            "[Instagram] Could not extend token to long-lived. Proceeding with short-lived token to inspect profile:",
            tokenErr
          );
          longToken = shortToken;
        }
        stage = "loading the Instagram profile";
        const profile = await fetchInstagramProfile(longToken.accessToken);
        const instagramUserId = String(
          profile.user_id ?? shortToken.userId ?? ""
        );
        if (!instagramUserId || !profile.username) {
          throw new Error(
            "Instagram did not return the authorized account profile."
          );
        }
        const accountType = String(profile.account_type ?? "");
        if (!/business|creator/i.test(accountType)) {
          throw new Error(
            `Account @${profile.username} is a ${accountType || "Personal"} account. Only Instagram Business or Creator accounts are supported. In Instagram, go to Settings -> Account type and tools -> Switch to professional account.`
          );
        }
        const expiresAt = typeof longToken.expiresIn === "number" && longToken.expiresIn > 0 ? new Date(Date.now() + longToken.expiresIn * 1e3) : null;
        stage = "saving the connected Instagram account";
        await upsertInstagramAccount({
          ownerOpenId: transaction.ownerOpenId,
          instagramUserId,
          username: profile.username,
          name: profile.name ?? null,
          accountType,
          profilePictureUrl: profile.profile_picture_url ?? null,
          followersCount: Number.isFinite(profile.followers_count) ? Number(profile.followers_count) : 0,
          mediaCount: Number.isFinite(profile.media_count) ? Number(profile.media_count) : 0,
          encryptedAccessToken: encryptInstagramToken(
            longToken.accessToken,
            appSecret
          ),
          tokenExpiresAt: expiresAt,
          grantedScopes: INSTAGRAM_SCOPES.join(",")
        });
        sendPopupResult(res, transaction.callbackUri, "connected");
      } catch (error) {
        const providerMessage = stage === "saving the connected Instagram account" ? "" : sanitizedMetaMessage(
          error instanceof Error ? error.message : "",
          [code]
        );
        const safeMessage = providerMessage ? `${stage}: ${providerMessage}` : `${stage} failed.`;
        console.error(
          "[Instagram] OAuth callback failed during",
          stage,
          providerMessage || "no safe provider message"
        );
        sendPopupResult(res, transaction.callbackUri, "error", safeMessage);
      }
    }
  );
}

// server/facebook.ts
import {
  createCipheriv as createCipheriv2,
  createDecipheriv as createDecipheriv2,
  createHash as createHash2,
  hkdfSync as hkdfSync2,
  randomBytes as randomBytes2
} from "node:crypto";
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";
var FACEBOOK_CALLBACK_PATH = "/api/facebook/callback";
var FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_read_user_content",
  "read_insights",
  "business_management"
];
var GRAPH_API_VERSION2 = "v21.0";
var OAUTH_STATE_MAX_AGE_MS2 = 10 * 60 * 1e3;
function metaCredentials2() {
  return {
    appId: process.env.META_FACEBOOK_APP_ID?.trim() || process.env.META_INSTAGRAM_APP_ID?.trim() || "",
    appSecret: process.env.META_FACEBOOK_APP_SECRET || process.env.META_INSTAGRAM_APP_SECRET || ""
  };
}
function isFacebookConfigured() {
  const { appId, appSecret } = metaCredentials2();
  return /^\d+$/.test(appId) && appSecret.length > 0;
}
function buildFacebookCallbackUri(origin) {
  const targetOrigin = process.env.APP_URL?.trim() || origin;
  let parsed;
  try {
    parsed = new URL(targetOrigin);
  } catch {
    throw new Error("A valid application origin is required.");
  }
  return new URL(FACEBOOK_CALLBACK_PATH, parsed.origin).toString();
}
function tokenEncryptionKey2(appSecret) {
  return Buffer.from(
    hkdfSync2(
      "sha256",
      Buffer.from(appSecret, "utf8"),
      Buffer.from("instadesk-meta-facebook-token-v1", "utf8"),
      Buffer.from("AES-256-GCM Facebook account token encryption", "utf8"),
      32
    )
  );
}
function encryptFacebookToken(token, appSecret) {
  if (!token || !appSecret) {
    throw new Error("Token and encryption secret are required.");
  }
  const iv = randomBytes2(12);
  const cipher = createCipheriv2("aes-256-gcm", tokenEncryptionKey2(appSecret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}
function decryptFacebookToken(encrypted, appSecret) {
  const [version, ivPart, tagPart, ciphertextPart] = encrypted.split(".");
  if (!version || !ivPart || !tagPart || !ciphertextPart || !appSecret) {
    throw new Error("Stored Facebook token has an unsupported format.");
  }
  const decipher = createDecipheriv2(
    "aes-256-gcm",
    tokenEncryptionKey2(appSecret),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
async function getFacebookTokenForUser(ownerOpenId, accountId) {
  const account = await getFacebookAccountForUser(ownerOpenId, accountId);
  if (!account) {
    throw new TRPCError3({
      code: "NOT_FOUND",
      message: "Facebook Page connection was not found."
    });
  }
  const { appSecret } = metaCredentials2();
  if (!appSecret) {
    throw new TRPCError3({
      code: "INTERNAL_SERVER_ERROR",
      message: "Meta app secret is not configured."
    });
  }
  const token = decryptFacebookToken(account.encryptedAccessToken, appSecret);
  return { account, token };
}
async function facebookGraphGet(endpoint, token, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION2}/${endpoint.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0) {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Facebook Graph API error HTTP ${response.status}`);
  }
  return data;
}
async function facebookGraphPost(endpoint, token, body) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION2}/${endpoint.replace(/^\//, "")}`);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Facebook Graph API error HTTP ${response.status}`);
  }
  return data;
}
async function facebookGraphDelete(endpoint, token) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION2}/${endpoint.replace(/^\//, "")}`);
  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Facebook Graph API error HTTP ${response.status}`);
  }
  return data;
}
async function countAllFacebookMedia(pageId, token) {
  let postsCount = 0;
  try {
    const postRes = await facebookGraphGet(
      `${encodeURIComponent(pageId)}/published_posts?summary=total_count&limit=0`,
      token
    );
    postsCount = postRes?.summary?.total_count || 0;
  } catch {
  }
  const videoIds = /* @__PURE__ */ new Set();
  try {
    let nextUrl = `${encodeURIComponent(pageId)}/video_reels?fields=id&limit=100`;
    while (nextUrl && videoIds.size < 2e3) {
      const res = await facebookGraphGet(nextUrl, token);
      if (!res?.data?.length) break;
      for (const item of res.data) {
        if (item.id) videoIds.add(String(item.id));
      }
      nextUrl = res.paging?.next ? res.paging.next.replace(/^https:\/\/graph\.facebook\.com\/v[0-9.]+\//, "") : null;
    }
  } catch {
  }
  try {
    let nextVidUrl = `${encodeURIComponent(pageId)}/videos?fields=id&limit=100`;
    while (nextVidUrl && videoIds.size < 2e3) {
      const res = await facebookGraphGet(nextVidUrl, token);
      if (!res?.data?.length) break;
      for (const item of res.data) {
        if (item.id) videoIds.add(String(item.id));
      }
      nextVidUrl = res.paging?.next ? res.paging.next.replace(/^https:\/\/graph\.facebook\.com\/v[0-9.]+\//, "") : null;
    }
  } catch {
  }
  return postsCount + videoIds.size;
}
function registerFacebookOAuthCallback(app) {
  app.get(FACEBOOK_CALLBACK_PATH, async (req, res) => {
    const errorParam = req.query.error;
    const errorDescription = req.query.error_description || req.query.error_reason;
    if (errorParam) {
      return renderCallbackPage(res, false, String(errorDescription || errorParam));
    }
    const code = req.query.code;
    const state = req.query.state;
    if (typeof code !== "string" || typeof state !== "string") {
      return renderCallbackPage(res, false, "Missing authorization code or state.");
    }
    const stateHash = createHash2("sha256").update(state, "utf8").digest("hex");
    const transaction = await consumeFacebookOAuthTransaction(stateHash);
    if (!transaction) {
      return renderCallbackPage(res, false, "Authorization session expired. Please start again from InstaDesk.");
    }
    const { appId, appSecret } = metaCredentials2();
    try {
      const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION2}/oauth/access_token`);
      tokenUrl.searchParams.set("client_id", appId);
      tokenUrl.searchParams.set("client_secret", appSecret);
      tokenUrl.searchParams.set("redirect_uri", transaction.callbackUri);
      tokenUrl.searchParams.set("code", code);
      const tokenRes = await fetch(tokenUrl.toString());
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        throw new Error(tokenData.error?.message || "Failed to exchange Facebook authorization code.");
      }
      const userAccessToken = tokenData.access_token;
      const pages = [];
      const seenPageIds = /* @__PURE__ */ new Set();
      let nextAccountsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION2}/me/accounts?fields=id,name,category,access_token,fan_count,picture{url}&limit=100&access_token=${encodeURIComponent(userAccessToken)}`;
      while (nextAccountsUrl) {
        const accountsRes = await fetch(nextAccountsUrl);
        const accountsData = await accountsRes.json();
        if (!accountsRes.ok || accountsData.error) {
          console.warn("[FacebookOAuth] /me/accounts warning:", accountsData.error?.message || accountsData.error);
          break;
        }
        if (Array.isArray(accountsData.data)) {
          for (const page of accountsData.data) {
            const pageIdStr = String(page.id);
            if (page.id && !seenPageIds.has(pageIdStr)) {
              seenPageIds.add(pageIdStr);
              pages.push(page);
            }
          }
        }
        nextAccountsUrl = accountsData.paging?.next || null;
      }
      try {
        const busRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION2}/me/businesses?access_token=${encodeURIComponent(userAccessToken)}&limit=50`
        );
        const busData = await busRes.json();
        if (Array.isArray(busData.data)) {
          for (const bus of busData.data) {
            try {
              const busPagesRes = await fetch(
                `https://graph.facebook.com/${GRAPH_API_VERSION2}/${bus.id}/owned_pages?fields=id,name,category,access_token,fan_count,picture{url}&access_token=${encodeURIComponent(userAccessToken)}&limit=100`
              );
              const busPagesData = await busPagesRes.json();
              if (Array.isArray(busPagesData.data)) {
                for (const page of busPagesData.data) {
                  const pageIdStr = String(page.id);
                  if (page.id && !seenPageIds.has(pageIdStr)) {
                    seenPageIds.add(pageIdStr);
                    pages.push(page);
                  }
                }
              }
            } catch {
            }
          }
        }
      } catch {
      }
      try {
        const debugRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION2}/debug_token?input_token=${encodeURIComponent(userAccessToken)}&access_token=${appId}|${appSecret}`
        );
        const debugData = await debugRes.json();
        const granularScopes = debugData.data?.granular_scopes || [];
        const targetIds = /* @__PURE__ */ new Set();
        for (const gs of granularScopes) {
          if (Array.isArray(gs.target_ids)) {
            for (const tid of gs.target_ids) {
              if (tid) targetIds.add(String(tid));
            }
          }
        }
        for (const tid of targetIds) {
          if (!seenPageIds.has(tid)) {
            try {
              const directPageRes = await fetch(
                `https://graph.facebook.com/${GRAPH_API_VERSION2}/${tid}?fields=id,name,category,access_token,fan_count,picture{url}&access_token=${encodeURIComponent(userAccessToken)}`
              );
              const directPageData = await directPageRes.json();
              if (directPageData && directPageData.id && directPageData.access_token) {
                seenPageIds.add(String(directPageData.id));
                pages.push(directPageData);
              }
            } catch (err) {
              console.warn(`[FacebookOAuth] Direct fetch failed for page ${tid}:`, err);
            }
          }
        }
      } catch (debugErr) {
        console.warn("[FacebookOAuth] debug_token inspection failed:", debugErr);
      }
      if (!pages.length) {
        throw new Error("No Facebook Pages found for this account. Create or manage a Facebook Page first.");
      }
      let connectedCount = 0;
      for (const page of pages) {
        if (!page.id || !page.access_token) {
          console.warn(`[FacebookOAuth] Skipping page ${page.id} (${page.name}) because no page access token was granted.`);
          continue;
        }
        let mediaCount = 0;
        try {
          mediaCount = await countAllFacebookMedia(String(page.id), page.access_token);
        } catch {
        }
        const encrypted = encryptFacebookToken(page.access_token, appSecret);
        await upsertFacebookAccount(transaction.ownerOpenId, {
          pageId: String(page.id),
          name: page.name || "Facebook Page",
          category: page.category || null,
          profilePictureUrl: page.picture?.data?.url || null,
          followersCount: page.fan_count || 0,
          mediaCount,
          encryptedAccessToken: encrypted,
          grantedScopes: FACEBOOK_SCOPES.join(",")
        });
        connectedCount++;
      }
      if (connectedCount === 0) {
        throw new Error("No manageable Facebook Pages found. Make sure you have Manage or Task permissions on your Pages.");
      }
      return renderCallbackPage(res, true, `Successfully connected ${connectedCount} Facebook Page${connectedCount === 1 ? "" : "s"}!`);
    } catch (err) {
      return renderCallbackPage(res, false, err?.message || "Could not complete Facebook authorization.");
    }
  });
}
function renderCallbackPage(res, success, message) {
  res.status(success ? 200 : 400).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Facebook Authorization - InstaDesk</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #1a1628; color: #fff; }
    .card { background: #262235; border: 1px solid #3d3752; padding: 32px; border-radius: 12px; max-width: 420px; text-align: center; }
    h2 { margin-top: 0; color: ${success ? "#4ade80" : "#f87171"}; }
    p { color: #b8b3c8; font-size: 14px; line-height: 1.5; }
    button { background: #6846e8; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${success ? "Connection Successful" : "Connection Failed"}</h2>
    <p>${message}</p>
    <button onclick="window.opener ? window.close() : window.location.href='/'">Return to InstaDesk</button>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: "instadesk:facebook-auth-complete",
        success: ${success},
        message: ${JSON.stringify(message)}
      }, "*");
      setTimeout(() => window.close(), 1200);
    }
  </script>
</body>
</html>`);
}
var facebookRouter = router({
  status: publicProcedure.input(z2.object({ origin: z2.string().url() })).query(({ input }) => {
    const configured = isFacebookConfigured();
    let callbackUri = null;
    if (configured) {
      try {
        callbackUri = buildFacebookCallbackUri(input.origin);
      } catch {
        callbackUri = null;
      }
    }
    return { configured, callbackUri };
  }),
  accounts: protectedProcedure.query(async ({ ctx }) => {
    const list = await listFacebookAccountsForUser(ctx.user.openId);
    return list.map((acc) => ({
      id: acc.id,
      pageId: acc.pageId,
      name: acc.name,
      category: acc.category,
      profilePictureUrl: acc.profilePictureUrl,
      followersCount: acc.followersCount,
      mediaCount: acc.mediaCount ?? 0,
      createdAt: acc.createdAt.toISOString(),
      updatedAt: acc.updatedAt.toISOString(),
      platform: "facebook"
    }));
  }),
  beginLogin: protectedProcedure.input(z2.object({ origin: z2.string().url() })).mutation(async ({ ctx, input }) => {
    const { appId, appSecret } = metaCredentials2();
    if (!/^\d+$/.test(appId) || !appSecret) {
      throw new TRPCError3({
        code: "PRECONDITION_FAILED",
        message: "Meta App ID and App Secret are not configured yet."
      });
    }
    const callbackUri = buildFacebookCallbackUri(input.origin);
    const state = randomBytes2(32).toString("hex");
    const stateHash = createHash2("sha256").update(state, "utf8").digest("hex");
    await createFacebookOAuthTransaction({
      stateHash,
      ownerOpenId: ctx.user.openId,
      callbackUri,
      expiresAt: new Date(Date.now() + OAUTH_STATE_MAX_AGE_MS2)
    });
    const url = new URL(`https://www.facebook.com/${GRAPH_API_VERSION2}/dialog/oauth`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", callbackUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", FACEBOOK_SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("auth_type", "rerequest");
    return { authUrl: url.toString() };
  }),
  directConnect: protectedProcedure.input(
    z2.object({
      pageId: z2.string().min(1, "Page ID is required"),
      pageAccessToken: z2.string().min(1, "Page Access Token is required"),
      pageName: z2.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const { appSecret } = metaCredentials2();
    if (!appSecret) {
      throw new TRPCError3({
        code: "PRECONDITION_FAILED",
        message: "Meta App Secret is not configured."
      });
    }
    let pageData;
    try {
      pageData = await facebookGraphGet(
        `${input.pageId}?fields=id,name,category,fan_count,picture{url}`,
        input.pageAccessToken
      );
    } catch (err) {
      throw new TRPCError3({
        code: "BAD_REQUEST",
        message: `Could not verify Facebook Page: ${err.message}`
      });
    }
    let mediaCount = 0;
    try {
      mediaCount = await countAllFacebookMedia(input.pageId, input.pageAccessToken);
    } catch {
    }
    const encrypted = encryptFacebookToken(input.pageAccessToken, appSecret);
    const saved = await upsertFacebookAccount(ctx.user.openId, {
      pageId: String(pageData.id || input.pageId),
      name: pageData.name || input.pageName || "Facebook Page",
      category: pageData.category || null,
      profilePictureUrl: pageData.picture?.data?.url || null,
      followersCount: pageData.fan_count || 0,
      mediaCount,
      encryptedAccessToken: encrypted,
      grantedScopes: FACEBOOK_SCOPES.join(",")
    });
    return {
      id: saved.id,
      pageId: saved.pageId,
      name: saved.name,
      followersCount: saved.followersCount,
      mediaCount: saved.mediaCount ?? 0
    };
  }),
  disconnect: protectedProcedure.input(z2.object({ accountId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await deleteFacebookAccount(ctx.user.openId, input.accountId);
    return { ok: true };
  })
});

// server/_core/publicConfig.ts
function publicPlatformConfig(env = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? ""
  };
}
function publicPlatformScript(env = process.env) {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}

// server/_core/systemRouter.ts
import { z as z3 } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError4({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError4({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError4({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError4({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError4({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError4({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z3.object({
      timestamp: z3.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z3.object({
      title: z3.string().min(1, "title is required"),
      content: z3.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/instagramInsights.ts
import { TRPCError as TRPCError6 } from "@trpc/server";
import { z as z4 } from "zod";

// server/instagramGraph.ts
import { TRPCError as TRPCError5 } from "@trpc/server";
var INSTAGRAM_GRAPH_API_VERSION = "v27.0";
var REFRESH_BEFORE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1e3;
function requiredAppSecret() {
  const secret = process.env.META_INSTAGRAM_APP_SECRET;
  if (!secret) {
    throw new TRPCError5({
      code: "PRECONDITION_FAILED",
      message: "Instagram server credentials are not configured."
    });
  }
  return secret;
}
function normalizeGraphError(error, token) {
  if (error.code === 190) {
    return "Instagram authorization expired. Reconnect this account and try again.";
  }
  const source = typeof error.message === "string" ? error.message : "";
  const sanitized = token ? source.replaceAll(token, "[redacted]") : source;
  const message = sanitized.replace(/[\r\n\t]+/g, " ").slice(0, 240).trim();
  return message || "Instagram rejected this request. Check the account permissions and media requirements.";
}
async function getInstagramTokenForUser(ownerOpenId, accountId) {
  const account = await getInstagramAccountForUser(ownerOpenId, accountId);
  if (!account) {
    throw new TRPCError5({
      code: "NOT_FOUND",
      message: "That connected Instagram account is no longer available."
    });
  }
  const appSecret = requiredAppSecret();
  let token;
  try {
    token = decryptInstagramToken(account.encryptedAccessToken, appSecret);
  } catch {
    throw new TRPCError5({
      code: "PRECONDITION_FAILED",
      message: "Reconnect this Instagram account. Its encrypted token cannot be opened with the current Meta App Secret."
    });
  }
  const expiryTime = account.tokenExpiresAt?.getTime() ?? null;
  if (expiryTime !== null && expiryTime <= Date.now()) {
    throw new TRPCError5({
      code: "UNAUTHORIZED",
      message: "Instagram authorization expired. Reconnect this account."
    });
  }
  if (expiryTime !== null && expiryTime - Date.now() < REFRESH_BEFORE_EXPIRY_MS) {
    const refreshUrl = new URL(
      "https://graph.instagram.com/refresh_access_token"
    );
    refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
    refreshUrl.searchParams.set("access_token", token);
    try {
      const response = await fetch(refreshUrl, {
        signal: AbortSignal.timeout(2e4)
      });
      const data = await response.json();
      if (!response.ok || data.error || typeof data.access_token !== "string" || !data.access_token) {
        throw new Error("Token refresh was rejected.");
      }
      token = data.access_token;
      const refreshedExpiry = typeof data.expires_in === "number" && data.expires_in > 0 ? new Date(Date.now() + data.expires_in * 1e3) : null;
      await updateInstagramAccountToken(
        ownerOpenId,
        accountId,
        encryptInstagramToken(token, appSecret),
        refreshedExpiry
      );
      account.encryptedAccessToken = encryptInstagramToken(token, appSecret);
      account.tokenExpiresAt = refreshedExpiry;
    } catch {
      throw new TRPCError5({
        code: "UNAUTHORIZED",
        message: "Instagram could not refresh this account's authorization. Reconnect it and try again."
      });
    }
  }
  return { account, token };
}
function accountHasScopes(account, scopes) {
  const granted = new Set(
    (account.grantedScopes ?? "").split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean)
  );
  return scopes.every((scope) => granted.has(scope));
}
async function instagramGraphGet(path6, token, query) {
  const url = new URL(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${path6}`
  );
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }
  return instagramGraphRequest(url, token);
}
async function instagramGraphPost(path6, token, fields) {
  const url = new URL(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${path6}`
  );
  const body = new URLSearchParams(fields);
  return instagramGraphRequest(url, token, body);
}
async function instagramGraphDelete(path6, token) {
  const url = new URL(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${path6}`
  );
  return instagramGraphRequest(url, token, void 0, "DELETE");
}
async function instagramGraphRequest(url, token, body, method) {
  const httpMethod = method || (body ? "POST" : "GET");
  let response;
  try {
    response = await fetch(url, {
      method: httpMethod,
      headers: {
        Authorization: `Bearer ${token}`,
        ...body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}
      },
      body,
      signal: AbortSignal.timeout(3e4)
    });
  } catch {
    throw new Error("Could not reach the Instagram Graph API.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Instagram returned an unreadable response.");
  }
  if (!response.ok || data.error) {
    throw new Error(normalizeGraphError(data.error ?? {}, token));
  }
  return data;
}

// server/instagramInsights.ts
var MANAGE_INSIGHTS = "instagram_business_manage_insights";
var rangeSchema = z4.enum(["7 days", "30 days", "90 days"]);
function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  if (value && typeof value === "object" && "count" in value) {
    return asNumber(value.count);
  }
  return null;
}
function normalizedDate(value) {
  if (!value) return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time.toISOString().slice(0, 10);
}
function metricsByDate(data) {
  const values = /* @__PURE__ */ new Map();
  for (const metric of data ?? []) {
    const metricName = metric.name;
    if (metricName !== "reach" && metricName !== "profile_views") continue;
    for (const item of metric.values ?? []) {
      const date = normalizedDate(item.end_time);
      if (!date) continue;
      const current = values.get(date) ?? {
        date,
        reach: null,
        profileViews: null
      };
      const amount = asNumber(item.value);
      if (metricName === "reach") current.reach = amount;
      else current.profileViews = amount;
      values.set(date, current);
    }
  }
  return [...values.values()].sort((a, b) => a.date.localeCompare(b.date));
}
async function getAccountInsights(ownerOpenId, accountId, range) {
  const account = await getInstagramAccountForUser(ownerOpenId, accountId);
  if (!account) {
    return {
      accountId,
      username: "Instagram account",
      followersCount: 0,
      mediaCount: 0,
      daily: [],
      errorMessage: "This connected account is no longer available."
    };
  }
  const base = {
    accountId,
    username: account.username,
    followersCount: account.followersCount,
    mediaCount: account.mediaCount
  };
  try {
    if (!accountHasScopes(account, [MANAGE_INSIGHTS])) {
      throw new Error(
        "Reconnect this account and grant Instagram Insights access."
      );
    }
    const { token } = await getInstagramTokenForUser(ownerOpenId, accountId);
    const profile = await instagramGraphGet("me", token, {
      fields: "user_id,username,account_type,followers_count,media_count"
    });
    const followersCount = typeof profile.followers_count === "number" && Number.isFinite(profile.followers_count) ? profile.followers_count : account.followersCount;
    const mediaCount = typeof profile.media_count === "number" && Number.isFinite(profile.media_count) ? profile.media_count : account.mediaCount;
    await updateInstagramAccountCounts(
      ownerOpenId,
      accountId,
      followersCount,
      mediaCount
    );
    const days = Number.parseInt(range, 10);
    const until = /* @__PURE__ */ new Date();
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1e3);
    const response = await instagramGraphGet(
      `${encodeURIComponent(account.instagramUserId)}/insights`,
      token,
      {
        metric: "reach,profile_views",
        period: "day",
        since: String(Math.floor(since.getTime() / 1e3)),
        until: String(Math.floor(until.getTime() / 1e3))
      }
    );
    return {
      ...base,
      followersCount,
      mediaCount,
      daily: metricsByDate(response.data),
      errorMessage: null
    };
  } catch (error) {
    return {
      ...base,
      daily: [],
      errorMessage: error instanceof Error ? error.message : "Instagram Insights are temporarily unavailable."
    };
  }
}
var instagramInsightsRouter = router({
  insights: protectedProcedure.input(
    z4.object({
      accountIds: z4.array(z4.number().int().positive()).max(20),
      range: rangeSchema
    })
  ).query(async ({ ctx, input }) => {
    if (new Set(input.accountIds).size !== input.accountIds.length) {
      throw new TRPCError6({
        code: "BAD_REQUEST",
        message: "Choose each Instagram account only once."
      });
    }
    return Promise.all(
      input.accountIds.map(
        (accountId) => getAccountInsights(ctx.user.openId, accountId, input.range)
      )
    );
  })
});

// server/instagramPublishing.ts
import { createHash as createHash3, randomUUID } from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";
import { TRPCError as TRPCError7 } from "@trpc/server";
import { z as z5 } from "zod";

// server/storage.ts
import fs from "node:fs";
import path from "node:path";
function hasForgeConfig() {
  return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
}
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set MANUS_API_URL and MANUS_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
var UPLOADS_DIR = path.join(process.cwd(), "uploads");
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}
async function storageGetSignedUrl(relKey, requestOrigin) {
  const key = normalizeKey(relKey);
  if (!hasForgeConfig()) {
    const port = process.env.PORT || "3000";
    const baseUrl = process.env.APP_URL || process.env.PUBLIC_URL || requestOrigin || `http://localhost:${port}`;
    return `${baseUrl.replace(/\/+$/, "")}/api/uploads/${encodeURIComponent(path.basename(key))}`;
  }
  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  if (!url) throw new Error("Storage did not return a download URL");
  return url;
}
async function storagePresignPut(relKey) {
  const key = normalizeKey(relKey);
  if (!key || !/^[\x20-\x7E]+$/.test(key)) {
    throw new Error("Storage key must be non-empty ASCII.");
  }
  if (!hasForgeConfig()) {
    ensureUploadsDir();
    return {
      key,
      uploadUrl: `/api/uploads/${encodeURIComponent(path.basename(key))}`,
      stableUrl: `/api/uploads/${encodeURIComponent(path.basename(key))}`
    };
  }
  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const response = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
    signal: AbortSignal.timeout(2e4)
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage presign failed (${response.status}): ${message}`);
  }
  const { url } = await response.json();
  if (!url) throw new Error("Storage returned an empty upload URL.");
  return { key, uploadUrl: url, stableUrl: `/manus-storage/${key}` };
}
async function storageDelete(relKey) {
  const key = normalizeKey(relKey);
  try {
    const filename = path.basename(key);
    const targetPath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
      return true;
    }
  } catch (err) {
    console.warn("[Storage] Failed to delete file:", relKey, err);
  }
  return false;
}
async function cleanupExpiredUploads(maxAgeMs = 5 * 60 * 1e3) {
  let count = 0;
  try {
    ensureUploadsDir();
    const files = await fs.promises.readdir(UPLOADS_DIR);
    const now = Date.now();
    for (const file of files) {
      if (file === ".gitkeep") continue;
      const filePath = path.join(UPLOADS_DIR, file);
      try {
        const stat = await fs.promises.stat(filePath);
        if (now - stat.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(filePath);
          count++;
        }
      } catch {
      }
    }
  } catch {
  }
  return count;
}

// server/instagramPublishing.ts
var MAX_IMAGE_BYTES = 8 * 1024 * 1024;
var MAX_REEL_BYTES = 300 * 1024 * 1024;
var UPLOAD_TICKET_TTL_MS = 30 * 60 * 1e3;
var MAX_TARGETS = 20;
var BASIC_SCOPE = "instagram_business_basic";
var PUBLISH_SCOPE = "instagram_business_content_publish";
var formatSchema = z5.enum(["post", "reel"]);
var mimeSchema = z5.enum(["image/jpeg", "video/mp4", "video/quicktime"]);
function mediaLimit(format) {
  return format === "post" ? MAX_IMAGE_BYTES : MAX_REEL_BYTES;
}
function assertFormatMime(format, contentType) {
  if (format === "post" && contentType !== "image/jpeg") {
    throw new TRPCError7({
      code: "BAD_REQUEST",
      message: "Instagram photo posts require a JPEG image file."
    });
  }
  if (format === "reel" && contentType !== "video/mp4" && contentType !== "video/quicktime") {
    throw new TRPCError7({
      code: "BAD_REQUEST",
      message: "Instagram Reels require an MP4 or MOV video."
    });
  }
}
function ownerStoragePrefix(ownerOpenId) {
  return createHash3("sha256").update(ownerOpenId).digest("hex").slice(0, 24);
}
function contentRangeSize(contentRange) {
  if (!contentRange) return null;
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}
async function verifyStoredMedia(upload, requestOrigin) {
  const localFile = path2.join(
    process.cwd(),
    "uploads",
    path2.basename(upload.storageKey)
  );
  if (fs2.existsSync(localFile)) {
    const stat = fs2.statSync(localFile);
    if (stat.size !== upload.sizeBytes) {
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: "The uploaded file size does not match."
      });
    }
    const buf = Buffer.alloc(16);
    const fd = fs2.openSync(localFile, "r");
    fs2.readSync(fd, buf, 0, 16, 0);
    fs2.closeSync(fd);
    const hasValidSignature2 = upload.format === "post" ? buf.length >= 3 && buf[0] === 255 && buf[1] === 216 && buf[2] === 255 : buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp";
    if (!hasValidSignature2) {
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: "The uploaded file does not match its declared format. Choose a valid JPEG or MP4 file."
      });
    }
    return await storageGetSignedUrl(upload.storageKey, requestOrigin);
  }
  const signedUrl = await storageGetSignedUrl(upload.storageKey, requestOrigin);
  const response = await fetch(signedUrl, {
    headers: { Range: "bytes=0-15" },
    signal: AbortSignal.timeout(2e4),
    redirect: "follow"
  });
  if (response.status !== 200 && response.status !== 206) {
    await response.body?.cancel().catch(() => void 0);
    throw new TRPCError7({
      code: "BAD_REQUEST",
      message: "The uploaded media could not be verified. Re-upload the file and try again."
    });
  }
  const actualType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const actualSize = contentRangeSize(response.headers.get("content-range")) ?? Number(response.headers.get("content-length"));
  const reader = response.body?.getReader();
  const firstChunk = reader ? await reader.read() : { value: void 0 };
  await reader?.cancel().catch(() => void 0);
  const signature = Buffer.from(firstChunk.value ?? new Uint8Array());
  const hasValidSignature = upload.format === "post" ? signature.length >= 3 && signature[0] === 255 && signature[1] === 216 && signature[2] === 255 : signature.length >= 8 && signature.toString("ascii", 4, 8) === "ftyp";
  if (actualType !== upload.contentType || actualSize !== upload.sizeBytes || !hasValidSignature) {
    throw new TRPCError7({
      code: "BAD_REQUEST",
      message: "The uploaded file does not match its declared format or size. Choose a valid JPEG or MP4 file."
    });
  }
  return signedUrl;
}
async function aggregateJobStatus(ownerOpenId, jobId) {
  const job = await getInstagramPublishJobForUser(ownerOpenId, jobId);
  if (!job) return;
  const published = job.targets.filter(
    (target) => target.status === "published"
  ).length;
  const failed = job.targets.filter(
    (target) => target.status === "failed"
  ).length;
  const active = job.targets.some(
    (target) => ["queued", "processing", "publishing"].includes(target.status)
  );
  const status = active ? "processing" : published === job.targets.length ? "completed" : published > 0 ? "partial" : failed === job.targets.length ? "failed" : "processing";
  await updateInstagramPublishJobStatus(ownerOpenId, jobId, status);
  if (!active && job.uploadId) {
    try {
      const upload = await getInstagramMediaUploadForUser(ownerOpenId, job.uploadId);
      if (upload?.storageKey) {
        await storageDelete(upload.storageKey);
      }
    } catch (cleanupErr) {
      console.warn("[InstagramPublish] Media cleanup error:", cleanupErr);
    }
  }
}
async function markTargetFailed(jobId, targetId, error) {
  const message = error instanceof Error && error.message ? error.message.replace(/[\r\n\t]+/g, " ").slice(0, 240) : "Instagram could not publish to this account. Check its connection and try again.";
  await updateInstagramPublishTarget(jobId, targetId, {
    status: "failed",
    errorMessage: message
  });
}
async function publishContainer(jobId, target, ownerOpenId) {
  const claimed = await claimInstagramPublishTarget(jobId, target.id);
  if (!claimed) return;
  try {
    const { account, token } = await getInstagramTokenForUser(
      ownerOpenId,
      target.instagramAccountId
    );
    if (!accountHasScopes(account, [BASIC_SCOPE, PUBLISH_SCOPE])) {
      throw new Error(
        "Reconnect this account and grant Instagram content-publishing access."
      );
    }
    const result = await instagramGraphPost(
      `${encodeURIComponent(account.instagramUserId)}/media_publish`,
      token,
      { creation_id: target.containerId }
    );
    const mediaId = typeof result.id === "string" ? result.id : null;
    if (!mediaId)
      throw new Error("Instagram did not confirm a published media ID.");
    let permalink = null;
    try {
      const media = await instagramGraphGet(encodeURIComponent(mediaId), token, { fields: "permalink" });
      permalink = typeof media.permalink === "string" ? media.permalink : null;
    } catch {
    }
    await updateInstagramPublishTarget(jobId, target.id, {
      status: "published",
      instagramMediaId: mediaId,
      permalink,
      errorMessage: null
    });
  } catch (error) {
    await markTargetFailed(jobId, target.id, error);
  }
}
async function publishFacebookTarget(ownerOpenId, jobId, format, caption, mediaUrl, target) {
  try {
    const { account, token } = await getFacebookTokenForUser(
      ownerOpenId,
      target.facebookAccountId
    );
    let postResponse;
    if (format === "reel") {
      postResponse = await facebookGraphPost(
        `${encodeURIComponent(account.pageId)}/videos`,
        token,
        {
          file_url: mediaUrl,
          description: caption
        }
      );
    } else {
      postResponse = await facebookGraphPost(
        `${encodeURIComponent(account.pageId)}/photos`,
        token,
        {
          url: mediaUrl,
          caption
        }
      );
    }
    if (!postResponse.id) {
      throw new Error("Facebook did not return a published post ID.");
    }
    await updateInstagramPublishTarget(jobId, target.id, {
      status: "published",
      instagramMediaId: postResponse.id,
      permalink: `https://facebook.com/${postResponse.id}`,
      errorMessage: null
    });
  } catch (error) {
    await markTargetFailed(jobId, target.id, error);
  }
}
async function checkReelTarget(ownerOpenId, jobId, target) {
  if (target.platform === "facebook" || !target.containerId || target.status !== "processing") return;
  const accountId = target.instagramAccountId;
  if (!accountId) {
    await markTargetFailed(
      jobId,
      target.id,
      new Error(
        "This Instagram account was disconnected before publishing completed."
      )
    );
    return;
  }
  try {
    const { account, token } = await getInstagramTokenForUser(
      ownerOpenId,
      accountId
    );
    if (!accountHasScopes(account, [BASIC_SCOPE, PUBLISH_SCOPE])) {
      throw new Error("Reconnect this account and grant publishing access.");
    }
    const status = await instagramGraphGet(
      encodeURIComponent(target.containerId),
      token,
      { fields: "status_code" }
    );
    const value = status.status_code?.toUpperCase();
    if (value === "ERROR" || value === "EXPIRED") {
      throw new Error(
        "Instagram could not process this Reel. Check the video requirements."
      );
    }
    if (value === "PUBLISHED") {
      await updateInstagramPublishTarget(jobId, target.id, {
        status: "published",
        errorMessage: null
      });
      return;
    }
    if (value !== "FINISHED") {
      await updateInstagramPublishTarget(jobId, target.id, {
        status: "processing",
        errorMessage: null
      });
      return;
    }
    await publishContainer(
      jobId,
      {
        id: target.id,
        instagramAccountId: accountId,
        username: target.username,
        containerId: target.containerId
      },
      ownerOpenId
    );
  } catch (error) {
    await markTargetFailed(jobId, target.id, error);
  }
}
async function createTargetMediaContainer(ownerOpenId, jobId, format, caption, mediaUrl, target) {
  try {
    const { account, token } = await getInstagramTokenForUser(
      ownerOpenId,
      target.instagramAccountId
    );
    if (!accountHasScopes(account, [BASIC_SCOPE, PUBLISH_SCOPE])) {
      throw new Error(
        "Reconnect this account and grant Instagram content-publishing access."
      );
    }
    const isLocalhost = mediaUrl.includes("localhost") || mediaUrl.includes("127.0.0.1") || mediaUrl.startsWith("http://0.0.0.0");
    if (isLocalhost && !process.env.APP_URL) {
      throw new Error(
        "Instagram requires a publicly accessible HTTPS URL to fetch media. For local testing, run a tunnel (e.g. 'ngrok http 3000') and add APP_URL=https://<your-tunnel-domain> to your .env file."
      );
    }
    const fields = format === "post" ? { image_url: mediaUrl, caption } : {
      media_type: "REELS",
      video_url: mediaUrl,
      caption,
      share_to_feed: "true"
    };
    const container = await instagramGraphPost(
      `${encodeURIComponent(account.instagramUserId)}/media`,
      token,
      fields
    );
    if (typeof container.id !== "string" || !container.id) {
      throw new Error("Instagram did not return a media container ID.");
    }
    await updateInstagramPublishTarget(jobId, target.id, {
      status: "processing",
      containerId: container.id,
      errorMessage: null
    });
    if (format === "post") {
      await publishContainer(
        jobId,
        { ...target, containerId: container.id },
        ownerOpenId
      );
      return;
    }
    await checkReelTarget(ownerOpenId, jobId, {
      ...target,
      containerId: container.id,
      status: "processing"
    });
  } catch (error) {
    await markTargetFailed(jobId, target.id, error);
  }
}
var instagramPublishingRouter = router({
  requestMediaUpload: protectedProcedure.input(
    z5.object({
      format: formatSchema,
      contentType: mimeSchema,
      sizeBytes: z5.number().int().positive()
    })
  ).mutation(async ({ ctx, input }) => {
    assertFormatMime(input.format, input.contentType);
    if (input.sizeBytes > mediaLimit(input.format)) {
      throw new TRPCError7({
        code: "PAYLOAD_TOO_LARGE",
        message: input.format === "post" ? "JPEG files must be 8 MB or smaller." : "MP4 or MOV Reels must be 300 MB or smaller."
      });
    }
    const accounts = await getInstagramAccountsForUser(ctx.user.openId);
    if (!accounts.length) {
      throw new TRPCError7({
        code: "PRECONDITION_FAILED",
        message: "Connect an Instagram Business or Creator profile first."
      });
    }
    const id = randomUUID();
    const extension = input.format === "post" ? "jpg" : input.contentType === "video/quicktime" ? "mov" : "mp4";
    const storageKey = `instadesk/${ownerStoragePrefix(ctx.user.openId)}/${id}.${extension}`;
    let ticket;
    try {
      ticket = await storagePresignPut(storageKey);
      await createInstagramMediaUpload({
        id,
        ownerOpenId: ctx.user.openId,
        storageKey: ticket.key,
        format: input.format,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        expiresAt: new Date(Date.now() + UPLOAD_TICKET_TTL_MS)
      });
    } catch {
      throw new TRPCError7({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not prepare secure media upload. Try again."
      });
    }
    return {
      uploadId: id,
      uploadUrl: ticket.uploadUrl,
      contentType: input.contentType,
      maxBytes: mediaLimit(input.format)
    };
  }),
  completeMediaUpload: protectedProcedure.input(z5.object({ uploadId: z5.string().uuid() })).mutation(async ({ ctx, input }) => {
    const upload = await getInstagramMediaUploadForUser(
      ctx.user.openId,
      input.uploadId
    );
    if (!upload || upload.expiresAt.getTime() <= Date.now()) {
      throw new TRPCError7({
        code: "NOT_FOUND",
        message: "The upload is missing or has expired. Choose the file again."
      });
    }
    if (upload.status === "ready") return { ready: true };
    if (upload.status !== "pending") {
      throw new TRPCError7({
        code: "CONFLICT",
        message: "This upload has already been used. Choose the file again."
      });
    }
    try {
      await verifyStoredMedia(upload);
      await markInstagramMediaUploadReady(ctx.user.openId, upload.id);
    } catch (error) {
      if (error instanceof TRPCError7) throw error;
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: "The uploaded media could not be verified. Re-upload the file and try again."
      });
    }
    return { ready: true };
  }),
  publish: protectedProcedure.input(
    z5.object({
      uploadId: z5.string().uuid(),
      format: formatSchema,
      caption: z5.string().max(5e3),
      perAccountCaptions: z5.record(z5.string(), z5.string().max(5e3)).optional(),
      accountIds: z5.array(z5.number().int().positive()).max(MAX_TARGETS).default([]),
      facebookAccountIds: z5.array(z5.number().int().positive()).max(MAX_TARGETS).default([])
    }).refine(
      (data) => data.accountIds.length > 0 || data.facebookAccountIds.length > 0,
      {
        message: "Select at least one destination account."
      }
    )
  ).mutation(async ({ ctx, input }) => {
    if (new Set(input.accountIds).size !== input.accountIds.length) {
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: "Select each connected Instagram account only once."
      });
    }
    if (new Set(input.facebookAccountIds).size !== input.facebookAccountIds.length) {
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: "Select each connected Facebook account only once."
      });
    }
    const upload = await getInstagramMediaUploadForUser(
      ctx.user.openId,
      input.uploadId
    );
    if (!upload || upload.status !== "ready" || upload.expiresAt.getTime() <= Date.now()) {
      throw new TRPCError7({
        code: "PRECONDITION_FAILED",
        message: "Upload and verify a photo or video before publishing."
      });
    }
    if (upload.format !== input.format) {
      throw new TRPCError7({
        code: "BAD_REQUEST",
        message: "The media type no longer matches the selected format."
      });
    }
    const igAccounts = await Promise.all(
      input.accountIds.map(
        (id) => getInstagramAccountForUser(ctx.user.openId, id)
      )
    );
    if (igAccounts.some((account) => !account)) {
      throw new TRPCError7({
        code: "FORBIDDEN",
        message: "Every Instagram destination must be connected to this workspace."
      });
    }
    const selectedIgAccounts = igAccounts.filter(
      (account) => Boolean(account)
    );
    for (const account of selectedIgAccounts) {
      if (!accountHasScopes(account, [BASIC_SCOPE, PUBLISH_SCOPE])) {
        throw new TRPCError7({
          code: "PRECONDITION_FAILED",
          message: `Reconnect @${account.username} and grant content-publishing access.`
        });
      }
    }
    const fbAccounts = await Promise.all(
      input.facebookAccountIds.map(
        (id) => getFacebookAccountForUser(ctx.user.openId, id)
      )
    );
    if (fbAccounts.some((account) => !account)) {
      throw new TRPCError7({
        code: "FORBIDDEN",
        message: "Every Facebook destination must be connected to this workspace."
      });
    }
    const selectedFbAccounts = fbAccounts.filter(
      (account) => Boolean(account)
    );
    const proto = ctx.req.headers["x-forwarded-proto"] || ctx.req.protocol || "https";
    const host = ctx.req.headers["x-forwarded-host"] || ctx.req.get("host") || "";
    const requestOrigin = host ? `${proto}://${host}` : void 0;
    let mediaUrl;
    try {
      mediaUrl = await verifyStoredMedia(upload, requestOrigin);
    } catch (error) {
      if (error instanceof TRPCError7) throw error;
      throw new TRPCError7({
        code: "PRECONDITION_FAILED",
        message: "The project-storage media could not be read. Re-upload it and try again."
      });
    }
    const jobId = randomUUID();
    const targets = [
      ...selectedIgAccounts.map((account) => ({
        id: randomUUID(),
        instagramAccountId: account.id,
        facebookAccountId: null,
        platform: "instagram",
        username: account.username
      })),
      ...selectedFbAccounts.map((account) => ({
        id: randomUUID(),
        instagramAccountId: null,
        facebookAccountId: account.id,
        platform: "facebook",
        username: account.name
      }))
    ];
    try {
      await createInstagramPublishJob({
        id: jobId,
        ownerOpenId: ctx.user.openId,
        uploadId: upload.id,
        format: input.format,
        caption: input.caption.trim(),
        targets
      });
    } catch (error) {
      throw new TRPCError7({
        code: "CONFLICT",
        message: error instanceof Error ? error.message : "Could not create this publishing job. Try again."
      });
    }
    const job = await getInstagramPublishJobForUser(
      ctx.user.openId,
      jobId
    );
    if (!job) {
      throw new TRPCError7({
        code: "INTERNAL_SERVER_ERROR",
        message: "Publishing was queued but its progress could not be loaded."
      });
    }
    await Promise.all(
      job.targets.map((target) => {
        const accountKey = target.instagramAccountId ? String(target.instagramAccountId) : target.facebookAccountId ? String(target.facebookAccountId) : null;
        const targetCaption = (accountKey && input.perAccountCaptions?.[accountKey] || input.caption).trim();
        if (target.platform === "facebook" || target.facebookAccountId) {
          return target.facebookAccountId ? publishFacebookTarget(
            ctx.user.openId,
            jobId,
            input.format,
            targetCaption,
            mediaUrl,
            {
              id: target.id,
              facebookAccountId: target.facebookAccountId,
              username: target.username
            }
          ) : markTargetFailed(
            jobId,
            target.id,
            new Error("The destination Facebook Page was disconnected.")
          );
        }
        return target.instagramAccountId ? createTargetMediaContainer(
          ctx.user.openId,
          jobId,
          input.format,
          targetCaption,
          mediaUrl,
          {
            id: target.id,
            instagramAccountId: target.instagramAccountId,
            username: target.username
          }
        ) : markTargetFailed(
          jobId,
          target.id,
          new Error("The destination account was disconnected.")
        );
      })
    );
    await aggregateJobStatus(ctx.user.openId, jobId);
    const result = await getInstagramPublishJobForUser(
      ctx.user.openId,
      jobId
    );
    if (!result) throw new TRPCError7({ code: "NOT_FOUND" });
    return result;
  }),
  advancePublishJob: protectedProcedure.input(z5.object({ jobId: z5.string().uuid() })).mutation(async ({ ctx, input }) => {
    const job = await getInstagramPublishJobForUser(
      ctx.user.openId,
      input.jobId
    );
    if (!job) {
      throw new TRPCError7({
        code: "NOT_FOUND",
        message: "This publishing job does not exist in your workspace."
      });
    }
    await Promise.all(
      job.targets.map(
        (target) => checkReelTarget(ctx.user.openId, job.id, target)
      )
    );
    await aggregateJobStatus(ctx.user.openId, job.id);
    const updated = await getInstagramPublishJobForUser(
      ctx.user.openId,
      job.id
    );
    if (!updated) throw new TRPCError7({ code: "NOT_FOUND" });
    return updated;
  }),
  publishHistory: protectedProcedure.query(
    ({ ctx }) => getInstagramPublishHistoryForUser(ctx.user.openId)
  )
});

// server/instagramPosts.ts
import { TRPCError as TRPCError8 } from "@trpc/server";
import { z as z6 } from "zod";
function asNumber2(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}
function getCutoffDate(range) {
  const now = /* @__PURE__ */ new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
    case "15d":
      return new Date(now.getTime() - 15 * 24 * 60 * 60 * 1e3);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
    case "6m":
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1e3);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1e3);
    case "all":
      return null;
  }
}
async function fetchPostsForAccount(ownerOpenId, accountId, limit = 25, range = "30d") {
  const account = await getInstagramAccountForUser(ownerOpenId, accountId);
  if (!account) return [];
  let token;
  try {
    const res = await getInstagramTokenForUser(ownerOpenId, accountId);
    token = res.token;
  } catch (error) {
    console.error(`[InstagramPosts] Token error for account ${accountId}:`, error);
    return [];
  }
  const cutoffDate = getCutoffDate(range);
  const params = {
    fields: "id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count",
    limit: String(Math.min(limit, 50))
  };
  if (cutoffDate) {
    params.since = String(Math.floor(cutoffDate.getTime() / 1e3));
  }
  let mediaResponse;
  try {
    mediaResponse = await instagramGraphGet("me/media", token, params);
  } catch (error) {
    console.error(`[InstagramPosts] Media list error for account ${accountId}:`, error);
    return [];
  }
  const rawItems = mediaResponse.data || [];
  if (!rawItems.length) return [];
  const filteredItems = cutoffDate ? rawItems.filter((item) => new Date(item.timestamp).getTime() >= cutoffDate.getTime()) : rawItems;
  if (!filteredItems.length) return [];
  const postsWithInsights = await Promise.all(
    filteredItems.map(async (item) => {
      let viewCount = null;
      let reachCount = null;
      let savedCount = null;
      let sharesCount = null;
      try {
        const insightsRes = await instagramGraphGet(
          `${item.id}/insights`,
          token,
          { metric: "views,reach,saved,shares" }
        );
        for (const metric of insightsRes.data || []) {
          const val = asNumber2(metric.values?.[0]?.value);
          if (metric.name === "views") viewCount = val;
          else if (metric.name === "reach") reachCount = val;
          else if (metric.name === "saved") savedCount = val;
          else if (metric.name === "shares") sharesCount = val;
        }
      } catch {
      }
      return {
        id: item.id,
        accountId: account.id,
        accountUsername: account.username,
        accountName: account.name ?? null,
        accountAvatar: account.profilePictureUrl ?? null,
        caption: item.caption ?? null,
        mediaType: item.media_type,
        mediaProductType: item.media_product_type ?? null,
        mediaUrl: item.media_url ?? null,
        thumbnailUrl: item.thumbnail_url ?? item.media_url ?? null,
        permalink: item.permalink ?? `https://www.instagram.com/p/${item.id}/`,
        timestamp: item.timestamp,
        likeCount: typeof item.like_count === "number" ? item.like_count : 0,
        commentsCount: typeof item.comments_count === "number" ? item.comments_count : 0,
        viewCount,
        reachCount,
        savedCount,
        sharesCount
      };
    })
  );
  return postsWithInsights;
}
var instagramPostsRouter = router({
  list: protectedProcedure.input(
    z6.object({
      accountId: z6.number().int().positive().optional(),
      range: z6.enum(["7d", "15d", "30d", "6m", "1y", "all"]).default("30d"),
      limit: z6.number().int().min(1).max(50).default(25)
    })
  ).query(async ({ ctx, input }) => {
    try {
      if (input.accountId) {
        const posts = await fetchPostsForAccount(
          ctx.user.openId,
          input.accountId,
          input.limit,
          input.range
        );
        return posts.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      }
      const accounts = await getInstagramAccountsForUser(ctx.user.openId);
      if (!accounts.length) return [];
      const allResults = await Promise.all(
        accounts.map(
          (acc) => fetchPostsForAccount(ctx.user.openId, acc.id, input.limit, input.range)
        )
      );
      return allResults.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      throw new TRPCError8({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Could not fetch posts from Instagram."
      });
    }
  })
});

// server/facebookPosts.ts
import { TRPCError as TRPCError9 } from "@trpc/server";
import { z as z7 } from "zod";
function extractFacebookMediaKey(url, id, targetId) {
  if (targetId) return `media_${targetId}`;
  if (url) {
    const match = url.match(/\/(?:reel|videos)\/([0-9]+)/);
    if (match) return `media_${match[1]}`;
    const cleanUrl = url.split("?")[0].replace(/\/+$/, "").toLowerCase();
    if (cleanUrl) return cleanUrl;
  }
  return `id_${id || ""}`;
}
function getCutoffDate2(range) {
  const now = /* @__PURE__ */ new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
    case "15d":
      return new Date(now.getTime() - 15 * 24 * 60 * 60 * 1e3);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
    case "6m":
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1e3);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1e3);
    case "all":
      return null;
  }
}
async function fetchFacebookPostsForAccount(ownerOpenId, accountId, limit = 25, range = "30d") {
  const account = await getFacebookAccountForUser(ownerOpenId, accountId);
  if (!account) return [];
  let token;
  try {
    const res = await getFacebookTokenForUser(ownerOpenId, accountId);
    token = res.token;
  } catch (error) {
    console.error(`[FacebookPosts] Token error for account ${accountId}:`, error);
    return [];
  }
  const cutoffDate = getCutoffDate2(range);
  const baseParams = {
    limit: String(Math.min(limit, 50))
  };
  if (cutoffDate) {
    baseParams.since = String(Math.floor(cutoffDate.getTime() / 1e3));
  }
  const richFields = "id,message,story,created_time,full_picture,permalink_url,shares,attachments{media_type,type,target{id,url},media{image{src}},unshimmed_url,title},reactions.summary(true).limit(0),comments.summary(true).limit(0)";
  const coreFields = "id,message,story,created_time,full_picture,permalink_url,shares,attachments{media_type,type,target{id,url},media{image{src}},unshimmed_url,title}";
  let postsResponse = null;
  const endpointCandidates = [
    `${encodeURIComponent(account.pageId)}/posts`,
    `${encodeURIComponent(account.pageId)}/published_posts`,
    `${encodeURIComponent(account.pageId)}/feed`
  ];
  for (const endpoint of endpointCandidates) {
    try {
      postsResponse = await facebookGraphGet(
        endpoint,
        token,
        { ...baseParams, fields: richFields }
      );
      if (postsResponse?.data) break;
    } catch {
      try {
        postsResponse = await facebookGraphGet(
          endpoint,
          token,
          { ...baseParams, fields: coreFields }
        );
        if (postsResponse?.data) break;
      } catch (coreError) {
        console.warn(
          `[FacebookPosts] Endpoint ${endpoint} failed:`,
          coreError instanceof Error ? coreError.message : coreError
        );
      }
    }
  }
  const rawItems = postsResponse?.data || [];
  const filteredItems = cutoffDate ? rawItems.filter((item) => new Date(item.created_time).getTime() >= cutoffDate.getTime()) : rawItems;
  const rawVideoMap = /* @__PURE__ */ new Map();
  try {
    const reelParams = {
      fields: "id,description,title,created_time,picture,source,permalink_url,views,length,likes.summary(true).limit(0),comments.summary(true).limit(0)",
      limit: String(Math.min(limit, 50))
    };
    if (cutoffDate) {
      reelParams.since = String(Math.floor(cutoffDate.getTime() / 1e3));
    }
    const reelsResponse = await facebookGraphGet(
      `${encodeURIComponent(account.pageId)}/video_reels`,
      token,
      reelParams
    );
    for (const r of reelsResponse?.data || []) {
      if (r.id) rawVideoMap.set(r.id, r);
    }
  } catch (reelErr) {
    console.warn(`[FacebookPosts] /video_reels fetch warning for ${account.pageId}:`, reelErr);
  }
  try {
    const videoParams = {
      fields: "id,description,title,created_time,picture,source,permalink_url,views,length,likes.summary(true).limit(0),comments.summary(true).limit(0)",
      limit: String(Math.min(limit, 50))
    };
    if (cutoffDate) {
      videoParams.since = String(Math.floor(cutoffDate.getTime() / 1e3));
    }
    const vidsResponse = await facebookGraphGet(
      `${encodeURIComponent(account.pageId)}/videos`,
      token,
      videoParams
    );
    for (const v of vidsResponse?.data || []) {
      if (v.id && !rawVideoMap.has(v.id)) {
        rawVideoMap.set(v.id, v);
      }
    }
  } catch (vidError) {
    console.warn(
      `[FacebookPosts] /videos fetch failed for ${account.pageId}:`,
      vidError instanceof Error ? vidError.message : vidError
    );
  }
  const rawVideoItems = Array.from(rawVideoMap.values());
  const filteredVideoItems = cutoffDate ? rawVideoItems.filter((item) => new Date(item.created_time).getTime() >= cutoffDate.getTime()) : rawVideoItems;
  const itemsMap = /* @__PURE__ */ new Map();
  const seenMediaIds = /* @__PURE__ */ new Set();
  for (const item of filteredVideoItems) {
    const isReel = item.permalink_url?.includes("/reel/") ?? false;
    let permalink = item.permalink_url || `https://facebook.com/${item.id}`;
    if (permalink.startsWith("/")) {
      permalink = `https://www.facebook.com${permalink}`;
    }
    const videoPost = {
      id: item.id,
      accountId: account.id,
      accountName: account.name,
      accountAvatar: account.profilePictureUrl ?? null,
      caption: item.description || item.title || null,
      mediaType: "VIDEO",
      mediaProductType: isReel ? "REELS" : null,
      mediaUrl: item.source || item.picture || null,
      thumbnailUrl: item.picture || null,
      permalink,
      timestamp: item.created_time,
      likeCount: item.likes?.summary?.total_count ?? 0,
      commentsCount: item.comments?.summary?.total_count ?? 0,
      sharesCount: null,
      viewCount: typeof item.views === "number" ? item.views : null,
      reachCount: typeof item.views === "number" ? item.views : null,
      platform: "facebook"
    };
    const key = extractFacebookMediaKey(permalink, item.id, item.id);
    itemsMap.set(key, videoPost);
    seenMediaIds.add(item.id);
  }
  for (const item of filteredItems) {
    const firstAttachment = item.attachments?.data?.[0];
    const targetId = firstAttachment?.target?.id;
    const key = extractFacebookMediaKey(item.permalink_url, item.id, targetId);
    if (itemsMap.has(key) || targetId && seenMediaIds.has(targetId) || seenMediaIds.has(item.id)) {
      const existing = itemsMap.get(key) || (targetId ? itemsMap.get(`media_${targetId}`) : void 0);
      if (existing) {
        if (!existing.caption && (item.message || item.story)) {
          existing.caption = item.message || item.story || null;
        }
        if (typeof item.shares?.count === "number" && existing.sharesCount === null) {
          existing.sharesCount = item.shares.count;
        }
      }
      continue;
    }
    let mediaType = "STATUS";
    let mediaProductType = null;
    if (firstAttachment?.media_type === "video" || firstAttachment?.type === "video_inline" || firstAttachment?.type === "video") {
      mediaType = "VIDEO";
      if (item.permalink_url?.includes("/reel/")) {
        mediaProductType = "REELS";
      }
    } else if (item.full_picture || firstAttachment?.media?.image?.src) {
      mediaType = "IMAGE";
    }
    const mediaUrl = item.full_picture || firstAttachment?.media?.image?.src || null;
    let likeCount = item.reactions?.summary?.total_count ?? 0;
    const commentsCount = item.comments?.summary?.total_count ?? 0;
    const sharesCount = typeof item.shares?.count === "number" ? item.shares.count : null;
    let viewCount = null;
    let reachCount = null;
    try {
      const insightsRes = await facebookGraphGet(`${encodeURIComponent(item.id)}/insights`, token, {
        metric: "post_reactions_by_type_total,post_clicks"
      });
      for (const metric of insightsRes.data || []) {
        if (metric.name === "post_reactions_by_type_total" && likeCount === 0) {
          const rxObj = metric.values?.[0]?.value;
          if (rxObj && typeof rxObj === "object") {
            const total = Object.values(rxObj).reduce(
              (sum, v) => sum + (Number(v) || 0),
              0
            );
            if (total > 0) likeCount = total;
          }
        } else if (metric.name === "post_clicks") {
          const clicks = Number(metric.values?.[0]?.value);
          if (Number.isFinite(clicks)) {
            viewCount = clicks;
          }
        }
      }
    } catch {
    }
    const postObj = {
      id: item.id,
      accountId: account.id,
      accountName: account.name,
      accountAvatar: account.profilePictureUrl ?? null,
      caption: item.message || item.story || firstAttachment?.title || null,
      mediaType,
      mediaProductType,
      mediaUrl,
      thumbnailUrl: item.full_picture || firstAttachment?.media?.image?.src || null,
      permalink: item.permalink_url || `https://facebook.com/${item.id}`,
      timestamp: item.created_time,
      likeCount,
      commentsCount,
      sharesCount,
      viewCount,
      reachCount,
      platform: "facebook"
    };
    itemsMap.set(key, postObj);
    seenMediaIds.add(item.id);
  }
  const finalPosts = Array.from(itemsMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  try {
    const totalAllMedia = await countAllFacebookMedia(account.pageId, token);
    if (totalAllMedia > 0) {
      await updateFacebookAccountMediaCount(account.id, totalAllMedia);
    } else if (finalPosts.length > 0) {
      await updateFacebookAccountMediaCount(account.id, finalPosts.length);
    }
  } catch {
    if (finalPosts.length > 0 && (!account.mediaCount || account.mediaCount < finalPosts.length)) {
      await updateFacebookAccountMediaCount(account.id, finalPosts.length);
    }
  }
  return finalPosts;
}
var facebookPostsRouter = router({
  list: protectedProcedure.input(
    z7.object({
      accountId: z7.number().int().positive().optional(),
      range: z7.enum(["7d", "15d", "30d", "6m", "1y", "all"]).default("30d"),
      limit: z7.number().int().min(1).max(50).default(25)
    })
  ).query(async ({ ctx, input }) => {
    try {
      if (input.accountId) {
        const posts = await fetchFacebookPostsForAccount(
          ctx.user.openId,
          input.accountId,
          input.limit,
          input.range
        );
        return posts.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      }
      const accounts = await listFacebookAccountsForUser(ctx.user.openId);
      if (!accounts.length) return [];
      const allResults = await Promise.all(
        accounts.map(
          (acc) => fetchFacebookPostsForAccount(ctx.user.openId, acc.id, input.limit, input.range)
        )
      );
      return allResults.flat().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      throw new TRPCError9({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Could not fetch posts from Facebook."
      });
    }
  })
});

// server/facebookInsights.ts
import { TRPCError as TRPCError10 } from "@trpc/server";
import { z as z8 } from "zod";
var rangeSchema2 = z8.enum(["7 days", "30 days", "90 days"]);
function asNumber3(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}
function normalizedDate2(value) {
  if (!value) return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time.toISOString().slice(0, 10);
}
function metricsByDate2(data) {
  const values = /* @__PURE__ */ new Map();
  for (const metric of data ?? []) {
    const metricName = metric.name;
    for (const item of metric.values ?? []) {
      const date = normalizedDate2(item.end_time);
      if (!date) continue;
      const current = values.get(date) ?? {
        date,
        reach: null,
        profileViews: null
      };
      const amount = asNumber3(item.value);
      if (metricName === "page_video_views") {
        current.videoViews = amount;
      } else if (metricName === "page_post_engagements") {
        current.engagements = amount;
      } else if (metricName === "page_views_total") {
        current.profileViews = amount;
      } else if (metricName === "page_impressions" || metricName === "page_engaged_users") {
        current.reach = amount;
      }
      values.set(date, current);
    }
  }
  return [...values.values()].map((current) => ({
    date: current.date,
    reach: current.reach !== null ? current.reach : current.videoViews !== void 0 || current.engagements !== void 0 ? (current.videoViews ?? 0) + (current.engagements ?? 0) : null,
    profileViews: current.profileViews
  })).sort((a, b) => a.date.localeCompare(b.date));
}
async function getFacebookPageInsights(ownerOpenId, accountId, range) {
  const account = await getFacebookAccountForUser(ownerOpenId, accountId);
  if (!account) {
    return {
      accountId,
      username: "Facebook Page",
      followersCount: 0,
      mediaCount: 0,
      daily: [],
      errorMessage: "This connected Facebook Page is no longer available.",
      platform: "facebook"
    };
  }
  const base = {
    accountId,
    username: account.name,
    followersCount: account.followersCount,
    mediaCount: 0,
    daily: [],
    errorMessage: null,
    platform: "facebook"
  };
  try {
    const { token } = await getFacebookTokenForUser(ownerOpenId, accountId);
    try {
      const livePage = await facebookGraphGet(
        `${encodeURIComponent(account.pageId)}?fields=fan_count,followers_count`,
        token
      );
      const fanCount = livePage.fan_count ?? livePage.followers_count;
      if (typeof fanCount === "number" && Number.isFinite(fanCount)) {
        base.followersCount = fanCount;
        await upsertFacebookAccount(ownerOpenId, {
          pageId: account.pageId,
          name: account.name,
          category: account.category,
          profilePictureUrl: account.profilePictureUrl,
          followersCount: fanCount,
          encryptedAccessToken: account.encryptedAccessToken,
          grantedScopes: account.grantedScopes
        });
      }
    } catch {
    }
    const days = Number.parseInt(range, 10);
    const until = /* @__PURE__ */ new Date();
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1e3);
    let response = { data: [] };
    try {
      response = await facebookGraphGet(
        `${encodeURIComponent(account.pageId)}/insights`,
        token,
        {
          metric: "page_views_total,page_post_engagements,page_video_views",
          period: "day",
          since: String(Math.floor(since.getTime() / 1e3)),
          until: String(Math.floor(until.getTime() / 1e3))
        }
      );
    } catch {
      const individualMetrics = [
        "page_video_views",
        "page_post_engagements",
        "page_views_total"
      ];
      const allData = [];
      for (const m of individualMetrics) {
        try {
          const single = await facebookGraphGet(
            `${encodeURIComponent(account.pageId)}/insights`,
            token,
            {
              metric: m,
              period: "day",
              since: String(Math.floor(since.getTime() / 1e3)),
              until: String(Math.floor(until.getTime() / 1e3))
            }
          );
          if (single.data) allData.push(...single.data);
        } catch {
        }
      }
      if (allData.length > 0) {
        response = { data: allData };
      }
    }
    return {
      ...base,
      daily: metricsByDate2(response.data),
      errorMessage: null
    };
  } catch (error) {
    return {
      ...base,
      daily: [],
      errorMessage: error instanceof Error ? error.message : "Facebook Page insights are temporarily unavailable."
    };
  }
}
var facebookInsightsRouter = router({
  insights: protectedProcedure.input(
    z8.object({
      accountIds: z8.array(z8.number().int().positive()).max(20),
      range: rangeSchema2
    })
  ).query(async ({ ctx, input }) => {
    if (new Set(input.accountIds).size !== input.accountIds.length) {
      throw new TRPCError10({
        code: "BAD_REQUEST",
        message: "Choose each Facebook account only once."
      });
    }
    return Promise.all(
      input.accountIds.map(
        (accountId) => getFacebookPageInsights(ctx.user.openId, accountId, input.range)
      )
    );
  })
});

// server/facebookPublishing.ts
import { TRPCError as TRPCError11 } from "@trpc/server";
import { z as z9 } from "zod";
var facebookPublishingRouter = router({
  publish: protectedProcedure.input(
    z9.object({
      accountIds: z9.array(z9.number().int().positive()).min(1).max(20),
      format: z9.enum(["post", "reel"]).default("post"),
      caption: z9.string().max(5e3),
      perAccountCaptions: z9.record(z9.string(), z9.string().max(5e3)).optional(),
      uploadId: z9.string().uuid().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    let mediaUrl;
    if (input.uploadId) {
      const upload = await getInstagramMediaUploadForUser(
        ctx.user.openId,
        input.uploadId
      );
      if (!upload || upload.expiresAt.getTime() <= Date.now()) {
        throw new TRPCError11({
          code: "NOT_FOUND",
          message: "The upload has expired or is not ready. Please select the file again."
        });
      }
      const proto = ctx.req.headers["x-forwarded-proto"] || ctx.req.protocol || "https";
      const host = ctx.req.headers["x-forwarded-host"] || ctx.req.get("host") || "";
      const requestOrigin = host ? `${proto}://${host}` : void 0;
      try {
        mediaUrl = await verifyStoredMedia(upload, requestOrigin);
      } catch (error) {
        throw new TRPCError11({
          code: "PRECONDITION_FAILED",
          message: error instanceof Error ? error.message : "The media file could not be verified."
        });
      }
    }
    const results = await Promise.all(
      input.accountIds.map(async (accountId) => {
        let accountName = "Facebook Page";
        let pageId = "";
        try {
          const { account, token } = await getFacebookTokenForUser(
            ctx.user.openId,
            accountId
          );
          accountName = account.name;
          pageId = account.pageId;
          const postCaption = (input.perAccountCaptions?.[String(accountId)] || input.caption).trim();
          let postResponse;
          if (mediaUrl) {
            if (input.format === "reel") {
              postResponse = await facebookGraphPost(
                `${encodeURIComponent(pageId)}/videos`,
                token,
                {
                  file_url: mediaUrl,
                  description: postCaption
                }
              );
            } else {
              postResponse = await facebookGraphPost(
                `${encodeURIComponent(pageId)}/photos`,
                token,
                {
                  url: mediaUrl,
                  caption: postCaption
                }
              );
            }
          } else {
            postResponse = await facebookGraphPost(
              `${encodeURIComponent(pageId)}/feed`,
              token,
              {
                message: postCaption
              }
            );
          }
          if (!postResponse.id) {
            throw new Error("Facebook did not return a published post ID.");
          }
          return {
            accountId,
            pageId,
            pageName: accountName,
            status: "published",
            postId: postResponse.id
          };
        } catch (err) {
          return {
            accountId,
            pageId,
            pageName: accountName,
            status: "failed",
            errorMessage: err.message || "Failed to publish to Facebook Page."
          };
        }
      })
    );
    if (input.uploadId) {
      try {
        const upload = await getInstagramMediaUploadForUser(
          ctx.user.openId,
          input.uploadId
        );
        if (upload?.storageKey) {
          await storageDelete(upload.storageKey);
        }
      } catch (cleanupErr) {
        console.warn("[FacebookPublish] Media cleanup warning:", cleanupErr);
      }
    }
    return results;
  })
});

// server/postManagement.ts
import { TRPCError as TRPCError12 } from "@trpc/server";
import { z as z10 } from "zod";
var postManagementRouter = router({
  getComments: protectedProcedure.input(
    z10.object({
      platform: z10.enum(["instagram", "facebook"]),
      accountId: z10.number(),
      postId: z10.string()
    })
  ).query(async ({ ctx, input }) => {
    const { platform, accountId, postId } = input;
    const ownerOpenId = ctx.user.openId;
    if (platform === "facebook") {
      const { token } = await getFacebookTokenForUser(ownerOpenId, accountId);
      try {
        const res = await facebookGraphGet(
          `${encodeURIComponent(postId)}/comments?fields=id,message,created_time,from{id,name,picture},like_count&limit=50&order=reverse_chronological`,
          token
        );
        const comments = (res?.data || []).map((item) => ({
          id: String(item.id),
          text: item.message || "",
          authorName: item.from?.name || "Facebook User",
          authorId: item.from?.id ? String(item.from.id) : void 0,
          authorAvatar: item.from?.picture?.data?.url || null,
          timestamp: item.created_time || (/* @__PURE__ */ new Date()).toISOString(),
          likeCount: item.like_count || 0
        }));
        return { comments };
      } catch (error) {
        console.warn("[Facebook getComments error]:", error.message);
        return { comments: [] };
      }
    } else {
      const { token } = await getInstagramTokenForUser(ownerOpenId, accountId);
      try {
        const res = await instagramGraphGet(
          `${encodeURIComponent(postId)}/comments?fields=id,text,timestamp,username,like_count&limit=50`,
          token
        );
        const comments = (res?.data || []).map((item) => ({
          id: String(item.id),
          text: item.text || "",
          authorName: item.username ? `@${item.username}` : "Instagram User",
          authorId: void 0,
          authorAvatar: null,
          timestamp: item.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
          likeCount: item.like_count || 0
        }));
        return { comments };
      } catch (error) {
        console.warn("[Instagram getComments error]:", error.message);
        return { comments: [] };
      }
    }
  }),
  addComment: protectedProcedure.input(
    z10.object({
      platform: z10.enum(["instagram", "facebook"]),
      accountId: z10.number(),
      postId: z10.string(),
      message: z10.string().min(1, "Comment message cannot be empty")
    })
  ).mutation(async ({ ctx, input }) => {
    const { platform, accountId, postId, message } = input;
    const ownerOpenId = ctx.user.openId;
    if (platform === "facebook") {
      const { token } = await getFacebookTokenForUser(ownerOpenId, accountId);
      try {
        const res = await facebookGraphPost(
          `${encodeURIComponent(postId)}/comments`,
          token,
          { message }
        );
        return {
          success: true,
          id: String(res.id),
          message: "Comment posted to Facebook."
        };
      } catch (error) {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: error.message || "Failed to post comment to Facebook."
        });
      }
    } else {
      const { token } = await getInstagramTokenForUser(ownerOpenId, accountId);
      try {
        const res = await instagramGraphPost(
          `${encodeURIComponent(postId)}/comments`,
          token,
          { message }
        );
        return {
          success: true,
          id: String(res.id),
          message: "Comment posted to Instagram."
        };
      } catch (error) {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: error.message || "Failed to post comment to Instagram."
        });
      }
    }
  }),
  deleteComment: protectedProcedure.input(
    z10.object({
      platform: z10.enum(["instagram", "facebook"]),
      accountId: z10.number(),
      commentId: z10.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const { platform, accountId, commentId } = input;
    const ownerOpenId = ctx.user.openId;
    if (platform === "facebook") {
      const { token } = await getFacebookTokenForUser(ownerOpenId, accountId);
      try {
        await facebookGraphDelete(`${encodeURIComponent(commentId)}`, token);
        return { success: true };
      } catch (error) {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: error.message || "Failed to delete comment from Facebook."
        });
      }
    } else {
      const { token } = await getInstagramTokenForUser(ownerOpenId, accountId);
      try {
        await instagramGraphDelete(`${encodeURIComponent(commentId)}`, token);
        return { success: true };
      } catch (error) {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: error.message || "Failed to delete comment from Instagram."
        });
      }
    }
  }),
  editPost: protectedProcedure.input(
    z10.object({
      platform: z10.enum(["instagram", "facebook"]),
      accountId: z10.number(),
      postId: z10.string(),
      caption: z10.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const { platform, accountId, postId, caption } = input;
    const ownerOpenId = ctx.user.openId;
    if (platform === "facebook") {
      const { token } = await getFacebookTokenForUser(ownerOpenId, accountId);
      try {
        try {
          await facebookGraphPost(`${encodeURIComponent(postId)}`, token, {
            message: caption
          });
          return {
            success: true,
            message: "Facebook post caption updated successfully."
          };
        } catch (firstErr) {
          if (firstErr.message?.includes("description") || firstErr.message?.includes("(#100)") || firstErr.message?.includes("param")) {
            await facebookGraphPost(`${encodeURIComponent(postId)}`, token, {
              description: caption
            });
            return {
              success: true,
              message: "Facebook video/reel description updated successfully."
            };
          }
          throw firstErr;
        }
      } catch (error) {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: error.message || "Failed to update Facebook post."
        });
      }
    } else {
      throw new TRPCError12({
        code: "BAD_REQUEST",
        message: "Meta Graph API does not support editing captions on published Instagram media. You can manage comments, reply, or delete and re-publish."
      });
    }
  }),
  deletePost: protectedProcedure.input(
    z10.object({
      platform: z10.enum(["instagram", "facebook"]),
      accountId: z10.number(),
      postId: z10.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const { platform, accountId, postId } = input;
    const ownerOpenId = ctx.user.openId;
    if (platform === "facebook") {
      const { token } = await getFacebookTokenForUser(ownerOpenId, accountId);
      try {
        await facebookGraphDelete(`${encodeURIComponent(postId)}`, token);
        await decrementFacebookAccountMediaCount(accountId);
        return {
          success: true,
          message: "Facebook post was deleted successfully."
        };
      } catch (error) {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: error.message || "Failed to delete post from Facebook."
        });
      }
    } else {
      const { token } = await getInstagramTokenForUser(ownerOpenId, accountId);
      try {
        await instagramGraphDelete(`${encodeURIComponent(postId)}`, token);
        await decrementInstagramAccountMediaCount(accountId);
        return {
          success: true,
          message: "Instagram post was deleted successfully."
        };
      } catch (error) {
        throw new TRPCError12({
          code: "BAD_REQUEST",
          message: error.message || "Failed to delete post from Instagram."
        });
      }
    }
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  instagram: instagramRouter,
  instagramInsights: instagramInsightsRouter,
  instagramPublishing: instagramPublishingRouter,
  instagramPosts: instagramPostsRouter,
  facebook: facebookRouter,
  facebookPosts: facebookPostsRouter,
  facebookInsights: facebookInsightsRouter,
  facebookPublishing: facebookPublishingRouter,
  postManagement: postManagementRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  if (!user && !process.env.MANUS_OAUTH_API_URL) {
    const localOpenId = process.env.OWNER_OPEN_ID || "local-admin";
    try {
      user = await getUserByOpenId(localOpenId) || null;
      if (!user) {
        await upsertUser({
          openId: localOpenId,
          name: "Admin",
          email: "admin@instadesk.local",
          role: "admin",
          loginMethod: "local"
        });
        user = await getUserByOpenId(localOpenId) || null;
      }
    } catch {
    }
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs4 from "fs";
import { nanoid } from "nanoid";
import path4 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs3 from "node:fs";
import path3 from "node:path";
import { defineConfig } from "vite";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path3.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs3.existsSync(LOG_DIR)) {
    fs3.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs3.existsSync(logPath) || fs3.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs3.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs3.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path3.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs3.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js"
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
function vitePluginPublicPlatformConfig() {
  return {
    name: "manus-public-platform-config",
    configureServer(server) {
      server.middlewares.use("/api/platform/config.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(publicPlatformScript());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "api/platform/config.js", source: publicPlatformScript() });
    }
  };
}
var plugins = [vitePluginPublicPlatformConfig(), react(), tailwindcss(), jsxLocPlugin(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path3.resolve(import.meta.dirname, "client", "src"),
      "@shared": path3.resolve(import.meta.dirname, "shared"),
      "@assets": path3.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path3.resolve(import.meta.dirname),
  root: path3.resolve(import.meta.dirname, "client"),
  publicDir: path3.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path3.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      // Setting deny replaces Vite's defaults, so they are repeated here first. Then dotfiles, and the
      // browser debug logs: they can hold request data of the people testing the Preview.
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.*", "**/.manus-logs/**"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    // Keep the file-serving limits of vite.config.ts; only the options above differ here.
    server: { ...vite_config_default.server, ...serverOptions },
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path4.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs4.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path4.resolve(import.meta.dirname, "../..", "dist", "public") : path4.resolve(import.meta.dirname, "public");
  if (!fs4.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.get("/404", (_req, res) => {
    res.status(404).sendFile(path4.resolve(distPath, "index.html"));
  });
  app.use("*", (_req, res) => {
    res.sendFile(path4.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
async function startServer() {
  const app = express2();
  const server = createServer(app);
  const uploadsDir = path5.join(process.cwd(), "uploads");
  if (!fs5.existsSync(uploadsDir)) {
    fs5.mkdirSync(uploadsDir, { recursive: true });
  }
  cleanupExpiredUploads().catch(() => {
  });
  setInterval(() => {
    cleanupExpiredUploads().catch(() => {
    });
  }, 5 * 60 * 1e3).unref();
  app.put(
    "/api/uploads/:key",
    express2.raw({ type: "*/*", limit: "350mb" }),
    (req, res) => {
      const targetPath = path5.join(uploadsDir, path5.basename(req.params.key));
      fs5.writeFileSync(targetPath, req.body);
      res.json({ ok: true, key: req.params.key });
    }
  );
  app.use("/api/uploads", express2.static(uploadsDir));
  app.use("/manus-storage", express2.static(uploadsDir));
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  registerInstagramOAuthCallback(app);
  registerFacebookOAuthCallback(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", (error) => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}
startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
