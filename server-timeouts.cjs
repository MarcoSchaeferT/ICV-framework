// Preloaded in the frontend container via `node --require ./server-timeouts.cjs server.js`
// (see Dockerfile.frontend).
//
// Node's HTTP server destroys any connection whose ENTIRE request (headers +
// body) has not arrived within `server.requestTimeout` — 300 s by default
// since Node 18. A multi-GB CSV upload on a slow connection takes far longer,
// so the socket was killed mid-upload and the browser reported "no server
// response" while the backend never received the full file.
//
// The Next.js standalone server exposes no config option for this (it only
// sets keepAliveTimeout), so patch createServer to disable the per-request
// cap on every server this process creates. headersTimeout (60 s) is left
// untouched: headers still have to arrive quickly, which keeps basic
// slow-loris protection intact.
const http = require('http');
const https = require('https');

for (const mod of [http, https]) {
  const orig = mod.createServer.bind(mod);
  mod.createServer = (...args) => {
    const server = orig(...args);
    server.requestTimeout = 0;
    return server;
  };
}
