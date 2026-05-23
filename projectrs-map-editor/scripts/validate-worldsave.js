import fs from 'fs'
import path from 'path'

const files = process.argv.slice(2)
const targets = files.length ? files : ['worldsave/main.json']

function isFiniteNumber(value) {
  return Number.isFinite(value)
}

function validateSave(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const map = data.map || data
  const issues = []

  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width <= 0 || map.height <= 0) {
    issues.push(`invalid dimensions: ${map.width}x${map.height}`)
  }

  if (!Array.isArray(map.tiles) || map.tiles.length !== map.height) {
    issues.push(`tiles row count ${map.tiles?.length ?? 'missing'} does not match height ${map.height}`)
  } else {
    for (let z = 0; z < map.height; z++) {
      if (!Array.isArray(map.tiles[z]) || map.tiles[z].length !== map.width) {
        issues.push(`tiles[${z}] length ${map.tiles[z]?.length ?? 'missing'} does not match width ${map.width}`)
        break
      }
    }
  }

  if (!Array.isArray(map.heights) || map.heights.length !== map.height + 1) {
    issues.push(`heights row count ${map.heights?.length ?? 'missing'} does not match height + 1 (${map.height + 1})`)
  } else {
    for (let z = 0; z <= map.height; z++) {
      if (!Array.isArray(map.heights[z]) || map.heights[z].length !== map.width + 1) {
        issues.push(`heights[${z}] length ${map.heights[z]?.length ?? 'missing'} does not match width + 1 (${map.width + 1})`)
        break
      }
      for (let x = 0; x <= map.width; x++) {
        if (!isFiniteNumber(map.heights[z][x])) {
          issues.push(`non-finite height at ${x},${z}`)
          break
        }
      }
    }
  }

  if (map.passable) {
    const ok = Array.isArray(map.passable)
      && map.passable.length === map.height
      && map.passable.every((row) => Array.isArray(row) && row.length === map.width)
    if (!ok) issues.push('passable dimensions do not match map dimensions')
  }

  if (map.blockedEdgesEW) {
    const ok = Array.isArray(map.blockedEdgesEW)
      && map.blockedEdgesEW.length === map.height
      && map.blockedEdgesEW.every((row) => Array.isArray(row) && row.length === map.width + 1)
    if (!ok) issues.push('blockedEdgesEW dimensions do not match map dimensions')
  }

  if (map.blockedEdgesNS) {
    const ok = Array.isArray(map.blockedEdgesNS)
      && map.blockedEdgesNS.length === map.height + 1
      && map.blockedEdgesNS.every((row) => Array.isArray(row) && row.length === map.width)
    if (!ok) issues.push('blockedEdgesNS dimensions do not match map dimensions')
  }

  for (const [index, obj] of (data.placedObjects || []).entries()) {
    const p = obj.position || {}
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y) || !isFiniteNumber(p.z)) {
      issues.push(`placedObjects[${index}] has a non-finite position`)
      continue
    }
    if (p.x < 0 || p.z < 0 || p.x > map.width || p.z > map.height) {
      issues.push(`placedObjects[${index}] is outside map bounds at (${p.x}, ${p.z})`)
    }

    const trigger = obj.trigger
    if (trigger) {
      const { entryX, entryY, entryZ } = trigger
      if (!isFiniteNumber(entryX) || !isFiniteNumber(entryY) || !isFiniteNumber(entryZ)) {
        issues.push(`placedObjects[${index}] trigger has non-finite entry coordinates`)
      } else if (entryX < 0 || entryZ < 0 || entryX > map.width || entryZ > map.height) {
        issues.push(`placedObjects[${index}] trigger entry is outside map bounds at (${entryX}, ${entryZ})`)
      }
    }
  }

  for (const [index, plane] of (map.texturePlanes || []).entries()) {
    const p = plane.position || {}
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y) || !isFiniteNumber(p.z)) {
      issues.push(`texturePlanes[${index}] has a non-finite position`)
    } else if (p.x < 0 || p.z < 0 || p.x > map.width || p.z > map.height) {
      issues.push(`texturePlanes[${index}] is outside map bounds at (${p.x}, ${p.z})`)
    }
  }

  return {
    file,
    width: map.width,
    height: map.height,
    worldOffset: map.worldOffset || null,
    placedObjects: (data.placedObjects || []).length,
    texturePlanes: (map.texturePlanes || []).length,
    triggers: (data.placedObjects || []).filter((obj) => obj.trigger).length,
    issues
  }
}

let failed = false
for (const target of targets) {
  const file = path.resolve(target)
  const result = validateSave(file)
  const label = path.relative(process.cwd(), file)
  if (result.issues.length) {
    failed = true
    console.error(`FAIL ${label}`)
    for (const issue of result.issues) console.error(`  - ${issue}`)
  } else {
    console.log(`OK ${label}: ${result.width}x${result.height}, ${result.placedObjects} objects, ${result.texturePlanes} texture planes, ${result.triggers} triggers`)
  }
}

if (failed) process.exit(1)
