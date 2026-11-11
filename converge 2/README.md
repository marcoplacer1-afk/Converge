# Converge — Multiplayer Wikipedia Race

This version includes Solo, 7-character multiplayer lobbies, real Wikipedia article search, a host-selected set of **any three existing English Wikipedia main-namespace pages**, 3-column article browsers, server-verified Wikipedia-link moves, automatic finish on the first convergence, and results showing all player paths.

## Deploy to Netlify (GitHub connection)

Upload **the contents of this folder** to the root of your GitHub repository, replacing the old `index.html` and `netlify/functions/wiki.mjs`, and adding:

- `netlify/functions/lobby.mjs`
- `netlify/functions/wiki-search.mjs`
- `package.json`
- `netlify.toml`

Keep the folder structure. Netlify should deploy with the repository root set as the Base directory, publish directory `.` and functions directory `netlify/functions`. **If your repository places everything in a subfolder such as `converge 2`, set Netlify's Base directory to that exact subfolder and upload the new files there instead.**

The project includes an npm dependency `@netlify/blobs`, which Netlify installs during deployment. Netlify Blobs stores shared lobby state, so real multiplayer requires Netlify hosting with server functions; opening index.html locally will not run multiplayer or Wikipedia article retrieval.

## How to play

1. One player selects `Create multiplayer lobby`, enters a name, and shares the 7-character room code.
2. Other players select `Join with code`, enter their own names and that code.
3. Host searches for *any* three existing English Wikipedia articles; exact article titles are accepted even if search suggestions do not load. Click `Save starting articles`, then `Start race`.
4. Every player receives the same 3 Wikipedia articles in side-by-side columns. Click blue article links to move forwards; each link is verified on the server and adds one move. There is no undo.
5. The first player whose three paths end on the exact same article wins. Every player's full path is shown on the results screen, including incomplete paths of runners-up.

The host can only choose articles in the main Wikipedia article namespace, and three distinct articles must be provided. Lobbies accept up to 12 players. Participants rejoin their own session after refreshing the same browser tab. Room progress syncs every 2.5 seconds (not a true socket connection).

This is a casual multiplayer implementation, not a production-scale anti-cheat platform. Netlify Blobs uses conditional writes to reduce race conflicts. No external API keys are needed, but Wikipedia and Netlify must be reachable. Player names and race paths are stored in Netlify Blobs for the lifetime of the room (there is no automatic lobby expiration/cleanup yet).
