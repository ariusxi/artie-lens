# [1.7.0](https://github.com/ariusxi/artie-lens/compare/v1.6.0...v1.7.0) (2026-07-02)


### Features

* add --watch dev loop and --suggest refactoring advice ([4a87ab4](https://github.com/ariusxi/artie-lens/commit/4a87ab401b38393eb628b15874d872f3e6139258))

# [1.6.0](https://github.com/ariusxi/artie-lens/compare/v1.5.0...v1.6.0) (2026-07-02)


### Bug Fixes

* honor tsconfig path aliases and scope analysis to globbed files ([ff77758](https://github.com/ariusxi/artie-lens/commit/ff7775852a706836410d31ae8537a4f7ef9be314))


### Features

* add composite GitHub Action wrapping the CLI ([89bd0ee](https://github.com/ariusxi/artie-lens/commit/89bd0ee130652f43bc4d140947519435f681afdf))

# [1.5.0](https://github.com/ariusxi/artie-lens/compare/v1.4.0...v1.5.0) (2026-07-02)


### Features

* add module-level CE and circular-dependency metrics ([93d59e6](https://github.com/ariusxi/artie-lens/commit/93d59e6e5f2747f74532dae9f7ea15e10457f9fb))

# [1.4.0](https://github.com/ariusxi/artie-lens/compare/v1.3.0...v1.4.0) (2026-07-02)


### Features

* add baseline diff mode to gate CI on regressions only ([d6c5846](https://github.com/ariusxi/artie-lens/commit/d6c584696e3bc62df2789ac40a1955f64cb4e636))

# [1.3.0](https://github.com/ariusxi/artie-lens/compare/v1.2.0...v1.3.0) (2026-07-02)


### Features

* add --json output and --fail-on exit code for CI gating ([f377737](https://github.com/ariusxi/artie-lens/commit/f3777370e96437448fb796a199bf5d97a8e6f7fb))

# [1.2.0](https://github.com/ariusxi/artie-lens/compare/v1.1.2...v1.2.0) (2026-07-02)


### Features

* add DIT and NOC inheritance metrics ([05b2b0c](https://github.com/ariusxi/artie-lens/commit/05b2b0c6d72898e34bd218bac04d97f7eda57b5d))

## [1.1.2](https://github.com/ariusxi/artie-lens/compare/v1.1.1...v1.1.2) (2026-07-02)


### Bug Fixes

* calculate CBO per class using AST, covering method bodies and heritage ([dc8bd6b](https://github.com/ariusxi/artie-lens/commit/dc8bd6bb3813d668f8b0b7711784215b638dfb20))
* calculate LCOM via AST, handling arrow fields, statics and empty-var case ([fc9c993](https://github.com/ariusxi/artie-lens/commit/fc9c9931edf146815866257fc31b809e9041caf0))
* calculate RFC per class using AST response set instead of regex ([4326c7f](https://github.com/ariusxi/artie-lens/commit/4326c7f31faa08c9137209bac8a5226631efa903))
* calculate WMC per class via AST and drop tsmetrics-core ([5907af7](https://github.com/ariusxi/artie-lens/commit/5907af7eac9182d6336fd4ccf29079ee8b83fbc4))
