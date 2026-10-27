// Vercel serverless entry: wraps the compiled Nest app (npm run vercel-build → dist/).
// Long-running hosts use `npm start` instead.
const { createApp } = require('../dist/main')

let server

module.exports = async function handler(req, res) {
  if (!server) {
    const app = await createApp()
    await app.init()
    server = app.getHttpAdapter().getInstance()
  }
  return server(req, res)
}
