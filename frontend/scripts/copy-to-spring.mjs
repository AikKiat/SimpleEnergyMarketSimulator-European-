/**
 * Copies the built frontend into Spring Boot's static directory.
 *
 * Vite now builds to ./dist because Vercel needs the output inside the project
 * root. This restores the "Spring serves everything at :8080" workflow for
 * local full-stack runs — same bundle, two destinations.
 *
 * Run via: npm run build:spring
 */

import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '..', 'dist')
const destination = resolve(here, '..', '..', 'src', 'main', 'resources', 'static')

// Wipe first: stale hashed asset filenames would otherwise pile up forever.
await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
await cp(source, destination, { recursive: true })

console.log(`Copied ${source} -> ${destination}`)
