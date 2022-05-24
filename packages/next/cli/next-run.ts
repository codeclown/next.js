#!/usr/bin/env node
import arg from 'next/dist/compiled/arg/index.js'
import { printAndExit } from '../server/lib/utils'
import { cliCommand } from '../bin/next'
import isError from '../lib/is-error'
import getBaseWebpackConfig from '../build/webpack-config'
import { getProjectDir } from '../lib/get-project-dir'
import { existsSync } from 'fs'
import { trace } from '../trace'
import loadConfig from '../server/config'
import { PHASE_PRODUCTION_BUILD } from '../shared/lib/constants'
import { NextConfigComplete } from '../server/config-shared'
import { runCompiler } from '../build/compiler'
import { findPagesDir } from '../lib/find-pages-dir'

const nextRun: cliCommand = (argv) => {
  const validArgs: arg.Spec = {
    // Types
    '--help': Boolean,

    // Aliases
    '-h': '--help',
  }
  let args: arg.Result<arg.Spec>
  try {
    args = arg(validArgs, { argv })
  } catch (error) {
    if (isError(error) && error.code === 'ARG_UNKNOWN_OPTION') {
      return printAndExit(error.message, 1)
    }
    throw error
  }
  if (args['--help']) {
    console.log(`
      Description
        Runs a script from a file, similarly to 'node script.js' but utilizing Webpack
        to compile before execution.

      Usage
        $ next run <file>

      Options
        --help, -h      Displays this message
    `)
    process.exit(0)
  }
  const dir = getProjectDir()

  // Check if the provided directory exists
  if (!existsSync(dir)) {
    printAndExit(`> No such directory exists as the project root: ${dir}`)
  }

  // How to test:
  // In root:
  //   yarn build
  // Then:
  //   cd examples/basic-css
  //   node --trace-deprecation --enable-source-maps ../../packages/next/dist/bin/next run scripts/test.js

  // yarn build && yarn next run scripts/check-manifests.js

  const file = args._[0]

  const nextBuildSpan = trace('next-run', undefined, {
    version: process.env.__NEXT_VERSION as string,
  })

  ;(async function asd() {
    const entrypointName = file

    const config: NextConfigComplete = await nextBuildSpan
      .traceChild('load-next-config')
      .traceAsyncFn(() => loadConfig(PHASE_PRODUCTION_BUILD, dir, null))

    const { pages: pagesDir, views: viewsDir } = findPagesDir(
      dir,
      config.experimental.viewsDir
    )

    const webpackConfig = await getBaseWebpackConfig(dir, {
      buildId: '',
      config,
      hasReactRoot: false,
      pagesDir,
      viewsDir,
      reactProductionProfiling: false,
      rewrites: {
        fallback: [],
        afterFiles: [],
        beforeFiles: [],
      },
      runWebpackSpan: nextBuildSpan,
      compilerType: 'server',
      entrypoints: {
        [entrypointName]: [file],
      },
      target: 'server',
    })

    const result = await runCompiler(webpackConfig, {
      runWebpackSpan: nextBuildSpan,
    })

    const { compiler, assets } = result.stats!.compilation

    console.log(assets)

    const compiledEntrypoint = `${compiler.options.output.path}/${entrypointName}`
    console.log(compiledEntrypoint)
  })()
}

export { nextRun }
