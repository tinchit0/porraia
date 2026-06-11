-- CreateTable
CREATE TABLE "BracketPick" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winnerTeamId" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BracketPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RealKnockout" (
    "slot" TEXT NOT NULL PRIMARY KEY,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winnerTeamId" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "BracketPick_userId_slot_key" ON "BracketPick"("userId", "slot");
