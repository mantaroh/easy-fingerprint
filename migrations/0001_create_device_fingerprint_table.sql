-- CreateTable
CREATE TABLE "DeviceFingerprint" (
    "compositeId" TEXT NOT NULL PRIMARY KEY,
    "fpId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "ua" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "tz" TEXT NOT NULL,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL
);
