import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(packageDirectory, 'src/tokens/tokens.json')
const destination = resolve(packageDirectory, 'dist/tokens/tokens.json')

await mkdir(dirname(destination), { recursive: true })
await copyFile(source, destination)
