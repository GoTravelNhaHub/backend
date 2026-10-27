/*
  Warnings:

  - You are about to drop the `klook_activities` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "attractionsg_events" ALTER COLUMN "id" DROP DEFAULT;

-- DropTable
DROP TABLE "klook_activities";
