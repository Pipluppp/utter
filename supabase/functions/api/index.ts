// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { Hono } from "npm:hono@4"

import { corsHeaders } from "../_shared/cors.ts"

import { generationsRoutes } from "./routes/generations.ts"
import { cloneRoutes } from "./routes/clone.ts"
import { designRoutes } from "./routes/design.ts"
import { generateRoutes } from "./routes/generate.ts"
import { languagesRoutes } from "./routes/languages.ts"
import { meRoutes } from "./routes/me.ts"
import { tasksRoutes } from "./routes/tasks.ts"
import { voicesRoutes } from "./routes/voices.ts"

const app = new Hono().basePath("/api")

app.options("*", (c) => c.body(null, 204, corsHeaders))

app.use("*", async (c, next) => {
  await next()
  for (const [key, value] of Object.entries(corsHeaders)) {
    c.header(key, value)
  }
})

app.get("/health", (c) => c.json({ ok: true }))

app.route("/", languagesRoutes)
app.route("/", meRoutes)
app.route("/", cloneRoutes)
app.route("/", voicesRoutes)
app.route("/", generateRoutes)
app.route("/", designRoutes)
app.route("/", generationsRoutes)
app.route("/", tasksRoutes)

Deno.serve(app.fetch)
