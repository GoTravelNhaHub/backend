// One place for configuration, read from the environment once. The shape matches the
// `runtimeConfig` the code used under Nuxt/Nitro, so services read `useRuntimeConfig().X` as before.
// Public values accept the NUXT_PUBLIC_* names the frontends also use.

const env = (name: string, fallback = '') => process.env[name] ?? fallback

function load() {
  return {
    SMTP_HOST: env('SMTP_HOST'),
    SMTP_PORT: env('SMTP_PORT'),
    SMTP_USER: env('SMTP_USER'),
    SMTP_PASS: env('SMTP_PASS'),
    /** Optional transport tuning; unset means the defaults in common/utils/email.ts */
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_REQUIRE_STARTTLS: process.env.SMTP_REQUIRE_STARTTLS,
    SMTP_TLS_MIN_VERSION: process.env.SMTP_TLS_MIN_VERSION,
    SMTP_TLS_CIPHERS: process.env.SMTP_TLS_CIPHERS,
    /** Seals the login session cookie. At least 32 random characters. */
    SESSION_PASSWORD: env('SESSION_PASSWORD'),
    /** Cookie domain shared by www, admin and api, e.g. `.gotravelnha.com`. Empty for localhost. */
    SESSION_COOKIE_DOMAIN: env('SESSION_COOKIE_DOMAIN'),
    /** Support inbox for contact messages (env name kept from the booking days) */
    SELF_BOOKING_NOTIFY_EMAIL: env('SELF_BOOKING_NOTIFY_EMAIL') || env('SMTP_USER'),
    /** Shared secret partners put in the conversion postback URL. Postbacks are off when unset. */
    AFFILIATE_POSTBACK_SECRET: env('AFFILIATE_POSTBACK_SECRET'),
    /** Browser origins allowed to call the API with credentials (comma-separated) */
    CORS_ORIGINS: env('CORS_ORIGINS', 'https://www.gotravelnha.com,https://gotravelnha.com,https://admin.gotravelnha.com'),

    /** Keycloak (auth.gotravelnha.com) */
    OIDC_ISSUER: env('OIDC_ISSUER', 'https://auth.gotravelnha.com/realms/gotravelnha'),
    OIDC_CLIENT_ID: env('OIDC_CLIENT_ID', 'gotravelnha-web'),
    OIDC_CLIENT_SECRET: env('OIDC_CLIENT_SECRET'),
    /** Audience Keycloak puts in access tokens for this API (web and mobile clients) */
    OIDC_AUDIENCE: env('OIDC_AUDIENCE', 'gotravelnha-api'),
    /** Service account used to create users and send "set your password" emails */
    KEYCLOAK_ADMIN_CLIENT_ID: env('KEYCLOAK_ADMIN_CLIENT_ID', 'iam-admin'),
    KEYCLOAK_ADMIN_CLIENT_SECRET: env('KEYCLOAK_ADMIN_CLIENT_SECRET'),

    public: {
      /** This API's own public origin; the OIDC redirect URI is `${apiUrl}/auth/callback` */
      apiUrl: env('NUXT_PUBLIC_API_URL', env('API_URL', 'https://api.gotravelnha.com')),
      siteUrl: env('NUXT_PUBLIC_SITE_URL', env('SITE_URL', 'https://www.gotravelnha.com')),
      adminUrl: env('NUXT_PUBLIC_ADMIN_URL', 'https://admin.gotravelnha.com'),
      supportEmail: env('NUXT_PUBLIC_SUPPORT_EMAIL'),
      enableCommunity: env('NUXT_PUBLIC_ENABLE_COMMUNITY', 'false'),
      communityDemo: env('NUXT_PUBLIC_COMMUNITY_DEMO', 'false'),
      TRIP_ALLIANCE_ID: env('TRIP_ALLIANCE_ID', '3883416'),
      TRIP_SID: env('TRIP_SID', '22874365'),
      TRIP_BASE_URL: env('TRIP_BASE_URL', 'https://www.trip.com'),
      KLOOK_AD_ID: env('KLOOK_AD_ID', '1041352'),
      KLOOK_AFFILIATE_FLIGHT_REDIRECT_URL: env('KLOOK_AFFILIATE_FLIGHT_REDIRECT_URL'),
      KLOOK_AFFILIATE_HOTEL_REDIRECT_URL: env('KLOOK_AFFILIATE_HOTEL_REDIRECT_URL'),
      KLOOK_AFFILIATE_ATTRACTION_REDIRECT_URL: env('KLOOK_AFFILIATE_ATTRACTION_REDIRECT_URL')
    }
  }
}

export type RuntimeConfig = ReturnType<typeof load>

let cached: RuntimeConfig | null = null

export function useRuntimeConfig(): RuntimeConfig {
  if (!cached) cached = load()
  return cached
}
