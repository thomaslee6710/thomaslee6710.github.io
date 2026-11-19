# Visitor map service

Create a Cloudflare D1 database, apply schema.sql, and bind the database to a Worker as VISITS. Deploy worker.mjs, then set data-visitor-endpoint in index.html to the deployed Worker URL ending in /visits. Keep the origin in worker.mjs in sync with the homepage origin. The map displays up to 500 recent homepage visits from the past 30 days. Land geometry is from Natural Earth via world-atlas 2.0.2.
