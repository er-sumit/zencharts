# Building Zen Charts

The minimal supported version of [NodeJS](https://nodejs.org/) for development is 22.3.

## Compiling

- `npm run tsc` - compiles the source code only (excluding tests)
- `npm run tsc-watch` - runs the TypeScript compiler in the watch mode
- `npm run tsc-verify` - compiles everything (source code and tests) to ensure no cyclic dependencies

## Bundling

- `npm run rollup` - runs Rollup to bundle code
- `npm run build` - compiles source code and bundles it
- `npm run build:prod` - compiles source code and bundles it for production (minified)

## Testing

- `npm run lint` - runs lint for the code
- `npm run test` - runs unit-tests
