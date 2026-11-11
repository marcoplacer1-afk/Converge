CONVERGE — REAL WIKIPEDIA LOADING
================================

IMPORTANT: To load full Wikipedia articles reliably, deploy this entire folder to Netlify.
The new Netlify function at netlify/functions/wiki.mjs fetches Wikipedia on the server,
so browsers don't have to make blocked cross-origin Wikipedia requests.

How to run online:
1. Visit https://app.netlify.com/drop and deploy the complete `converge` folder,
   not just index.html. Depending on your Netlify setup, drag-and-drop deployment
   may not build functions; if that happens, import this folder as a Git repository
   in Netlify and deploy via its standard build process.
2. Open your deployed URL.
3. Test https://YOUR-SITE.netlify.app/api/wiki?title=Octopus — it should return JSON
   containing title and HTML, not a 404 or HTML page.
4. Press Play in the app; all 3 readers should show the real article content.

Local test (with Netlify CLI installed):
  netlify dev
Then browse the local dev URL printed by the CLI.

IMPORTANT: Double-clicking index.html or opening it from a sandbox preview doesn't
run Netlify functions. The app tries direct Wikipedia APIs as a fallback, but those
may be blocked. A basic static web host (or a plain local HTTP server) also does NOT
run the included serverless function.

Rules: Three independently navigable Wikipedia pages. Click real article links,
converge to the exact same article, and minimize your total number of clicks.
