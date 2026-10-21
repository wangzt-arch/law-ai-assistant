import packager from 'electron-packager'
import { readdir, rm } from 'node:fs/promises'
import path from 'node:path'

const KEEP_LOCALES = new Set(['zh-CN.pak', 'zh-TW.pak', 'en-US.pak', 'en-GB.pak'])
const ALLOWED_DIRS = ['/build', '/src/electron', '/src/images']

function keepInPackage(name) {
  if (!name.startsWith('/')) return true
  if (name === '/package.json' || name === '/src') return true
  return ALLOWED_DIRS.some((dir) => name === dir || name.startsWith(`${dir}/`))
}

const appPaths = await packager({
  dir: '.',
  name: '法律AI助手-小卢',
  platform: 'win32',
  arch: 'x64',
  out: 'dist',
  icon: path.resolve('src/images/star.ico'),
  overwrite: true,
  asar: true,
  ignore: (file) => !keepInPackage(file.replace(/\\/g, '/'))
})

for (const appPath of appPaths) {
  const localesDir = path.join(appPath, 'locales')
  const files = await readdir(localesDir).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  await Promise.all(
    files
      .filter((file) => !KEEP_LOCALES.has(file))
      .map((file) => rm(path.join(localesDir, file), { force: true }))
  )
}

console.log(`打包完成：${appPaths.join(', ')}`)
