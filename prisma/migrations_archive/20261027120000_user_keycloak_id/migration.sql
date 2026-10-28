-- Keycloak (auth.gotravelnha.com) user id
ALTER TABLE "users" ADD COLUMN "keycloakId" TEXT;
CREATE UNIQUE INDEX "users_keycloakId_key" ON "users"("keycloakId");
