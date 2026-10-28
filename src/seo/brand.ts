// GoTravelNha mark: map pin with a house inside, in the community blue.
// Keep in sync with ../web/public/favicon.svg, ../web/components/Logo.vue and ../admin/public/favicon.svg.
export const FAVICON_SVG = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="13" fill="#0066E4"/>
  <path d="M24 39.5c-7-7.4-10.5-12.7-10.5-17.3a10.5 10.5 0 0 1 21 0c0 4.6-3.5 9.9-10.5 17.3Z" fill="#FFFFFF"/>
  <path d="M18.8 23 24 18.4l5.2 4.6v5.5H18.8Z" fill="#0066E4"/>
  <circle cx="35.5" cy="12.5" r="3.2" fill="#FBBF24"/>
</svg>
`

// Swagger UI (/docs): our mark and name in the top bar instead of the Swagger logo
export const SWAGGER_CSS = `
.swagger-ui .topbar { background: #0A1024; padding: 12px 0; }
.swagger-ui .topbar-wrapper a.link svg,
.swagger-ui .topbar-wrapper a.link img { display: none; }
.swagger-ui .topbar-wrapper a.link { display: inline-flex; align-items: center; gap: 10px; }
.swagger-ui .topbar-wrapper a.link::before {
  content: ''; width: 36px; height: 36px; background: url('/favicon.svg') center / contain no-repeat;
}
.swagger-ui .topbar-wrapper a.link::after {
  content: 'GoTravelNha API'; color: #FFFFFF; font: 700 19px/1 Inter, system-ui, -apple-system, sans-serif; letter-spacing: -0.025em;
}
`
