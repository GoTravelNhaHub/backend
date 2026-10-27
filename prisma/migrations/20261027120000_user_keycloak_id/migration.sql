-- Keycloak (auth.gotravelnha.com) user id
ALTER TABLE "User" ADD COLUMN "keycloakId" TEXT;
CREATE UNIQUE INDEX "User_keycloakId_key" ON "User"("keycloakId");
