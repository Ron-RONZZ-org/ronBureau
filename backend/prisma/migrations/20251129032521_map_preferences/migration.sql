-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "mapPreferences" TEXT;

-- CreateTable
CREATE TABLE "SavedPlace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📍',
    "color" TEXT NOT NULL DEFAULT '#ef4444',
    "geojson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedRoute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originName" TEXT NOT NULL,
    "originLon" DOUBLE PRECISION NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "destName" TEXT NOT NULL,
    "destLon" DOUBLE PRECISION NOT NULL,
    "destLat" DOUBLE PRECISION NOT NULL,
    "stops" TEXT,
    "distance" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "coordinates" TEXT NOT NULL,
    "geojson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPlace_userId_idx" ON "SavedPlace"("userId");

-- CreateIndex
CREATE INDEX "SavedRoute_userId_idx" ON "SavedRoute"("userId");
