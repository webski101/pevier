CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "googleSubject" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Agent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'RUNNING',
  "risk" INTEGER NOT NULL DEFAULT 0,
  "postsToday" INTEGER NOT NULL DEFAULT 0,
  "blocks" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Channel" (
  "id" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'RUNNING',
  "risk" INTEGER NOT NULL DEFAULT 0,
  "agentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Post" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "contentText" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "decision" TEXT,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "syntheticMedia" BOOLEAN NOT NULL DEFAULT false,
  "targetRegionsJson" TEXT NOT NULL DEFAULT '[]',
  "policyResultsJson" TEXT NOT NULL DEFAULT '[]',
  "scheduledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "agentId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "userId" TEXT,
  CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Incident" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "affectedPosts" INTEGER NOT NULL,
  "affectedChannels" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "timelineJson" TEXT NOT NULL,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditRecord" (
  "id" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor" TEXT NOT NULL,
  "agentId" TEXT,
  "channelId" TEXT,
  "platform" TEXT,
  "action" TEXT NOT NULL,
  "decision" TEXT,
  "riskScore" INTEGER,
  "policyResultsJson" TEXT NOT NULL DEFAULT '[]',
  "previousHash" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "userId" TEXT,
  CONSTRAINT "AuditRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CircuitState" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "reason" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CircuitState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PolicySetting" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "userId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "warnAt" DOUBLE PRECISION,
  "holdAt" DOUBLE PRECISION,
  "blockAt" DOUBLE PRECISION,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PolicySetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformConnection" (
  "id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "userId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  "mode" TEXT NOT NULL DEFAULT 'DRY_RUN',
  "accountLabel" TEXT,
  "channelId" TEXT,
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "scope" TEXT NOT NULL,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt");
CREATE INDEX "Incident_userId_createdAt_idx" ON "Incident"("userId", "createdAt");
CREATE INDEX "AuditRecord_userId_timestamp_idx" ON "AuditRecord"("userId", "timestamp");
CREATE UNIQUE INDEX "CircuitState_scope_scopeId_key" ON "CircuitState"("scope", "scopeId");
CREATE INDEX "PolicySetting_userId_idx" ON "PolicySetting"("userId");
CREATE UNIQUE INDEX "PolicySetting_userId_policyId_key" ON "PolicySetting"("userId", "policyId");
CREATE INDEX "PlatformConnection_userId_idx" ON "PlatformConnection"("userId");
CREATE UNIQUE INDEX "PlatformConnection_userId_platform_key" ON "PlatformConnection"("userId", "platform");

ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditRecord" ADD CONSTRAINT "AuditRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PolicySetting" ADD CONSTRAINT "PolicySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformConnection" ADD CONSTRAINT "PlatformConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
