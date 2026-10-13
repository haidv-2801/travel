-- CreateTable
CREATE TABLE "TripItemVote" (
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "TripItemVote_pkey" PRIMARY KEY ("itemId","userId")
);

-- CreateTable
CREATE TABLE "TripItemComment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripItemComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripItemVote_userId_idx" ON "TripItemVote"("userId");

-- CreateIndex
CREATE INDEX "TripItemComment_itemId_createdAt_idx" ON "TripItemComment"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "TripItemComment_userId_idx" ON "TripItemComment"("userId");

-- AddForeignKey
ALTER TABLE "TripItemVote" ADD CONSTRAINT "TripItemVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TripItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripItemVote" ADD CONSTRAINT "TripItemVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripItemComment" ADD CONSTRAINT "TripItemComment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TripItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripItemComment" ADD CONSTRAINT "TripItemComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
