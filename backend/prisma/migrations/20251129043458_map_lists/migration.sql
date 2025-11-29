-- AlterTable
ALTER TABLE "SavedPlace" ADD COLUMN     "listId" TEXT;

-- AlterTable
ALTER TABLE "SavedRoute" ADD COLUMN     "listId" TEXT;

-- CreateTable
CREATE TABLE "MapPlaceList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapPlaceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapRouteList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapRouteList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MapPlaceList_userId_idx" ON "MapPlaceList"("userId");

-- CreateIndex
CREATE INDEX "MapRouteList_userId_idx" ON "MapRouteList"("userId");

-- CreateIndex
CREATE INDEX "SavedPlace_listId_idx" ON "SavedPlace"("listId");

-- CreateIndex
CREATE INDEX "SavedRoute_listId_idx" ON "SavedRoute"("listId");

-- AddForeignKey
ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MapPlaceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRoute" ADD CONSTRAINT "SavedRoute_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MapRouteList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
