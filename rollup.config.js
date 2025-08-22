import typescript from '@rollup/plugin-typescript'
import { builtinModules } from 'module'
import { dts } from 'rollup-plugin-dts'

import pkg from './package.json'

const config = [
  {
    input: 'src/index.ts',
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
    external: [
      ...builtinModules,
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ],
    output: [
      {
        file:  pkg.main,
        format: 'cjs',
        sourcemap: true,
      },
    ],
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'artie-lens.d.ts',
      format: 'es',
    },
    plugins: [dts()],
    external: [
      ...builtinModules,
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ]
  }
]

export default config