# [1.18.0](https://github.com/ariusxi/artie-lens/compare/v1.17.0...v1.18.0) (2026-07-21)


### Features

* **dashboard:** interactive instrument-style dashboard with tabs and charts ([f4c3c26](https://github.com/ariusxi/artie-lens/commit/f4c3c266364b89081e3816decc994610ec3c9233))
* **dashboard:** light/dark theme toggle and 10-language i18n ([119d5aa](https://github.com/ariusxi/artie-lens/commit/119d5aa3ff10ceada3e4dd223eac6cec62e43b54))

# [1.17.0](https://github.com/ariusxi/artie-lens/compare/v1.16.1...v1.17.0) (2026-07-20)


### Features

* APM-style dashboard with a live server, HTML split into a template layer ([b77a56a](https://github.com/ariusxi/artie-lens/commit/b77a56af59173b3d515d888ddb0c77611f9ed088))

## [1.16.1](https://github.com/ariusxi/artie-lens/compare/v1.16.0...v1.16.1) (2026-07-20)


### Bug Fixes

* export the documented API from the barrel and fix a ts-morph path type ([c24fe37](https://github.com/ariusxi/artie-lens/commit/c24fe371dd9a3df9c580a5441ae6c630a9d9279b))

# [1.16.0](https://github.com/ariusxi/artie-lens/compare/v1.15.0...v1.16.0) (2026-07-20)


### Features

* add historical trend tracking with run --record and trend ([0420888](https://github.com/ariusxi/artie-lens/commit/04208883dca561a8e881e08aee8d2ffffa839f86))

# [1.15.0](https://github.com/ariusxi/artie-lens/compare/v1.14.0...v1.15.0) (2026-07-20)


### Features

* add distance metric (Martin's distance from the main sequence) ([c87863d](https://github.com/ariusxi/artie-lens/commit/c87863d453da1a77a3f7cc207bfb3fad8638f0ad))

# [1.14.0](https://github.com/ariusxi/artie-lens/compare/v1.13.0...v1.14.0) (2026-07-20)


### Features

* add SARIF and HTML report outputs to run ([30f549e](https://github.com/ariusxi/artie-lens/commit/30f549e0f75728529312b5d49825bc1834d62387))

# [1.13.0](https://github.com/ariusxi/artie-lens/compare/v1.12.0...v1.13.0) (2026-07-15)


### Features

* add comment command to post a sticky PR summary ([f317018](https://github.com/ariusxi/artie-lens/commit/f3170188d5d646f412af426cdb62a2f12f6bb0e0))

# [1.12.0](https://github.com/ariusxi/artie-lens/compare/v1.11.1...v1.12.0) (2026-07-15)


### Features

* add seams command to find module extraction boundaries ([20c1ff0](https://github.com/ariusxi/artie-lens/commit/20c1ff0c1bd865fe5b02379ea9f1b0fa33c8134e))

## [1.11.1](https://github.com/ariusxi/artie-lens/compare/v1.11.0...v1.11.1) (2026-07-15)


### Bug Fixes

* report a clean error for missing or invalid .artierc.json ([79d340b](https://github.com/ariusxi/artie-lens/commit/79d340b89c6dce0ec723f5bbe11c56009b0aa6f2))

# [1.11.0](https://github.com/ariusxi/artie-lens/compare/v1.10.1...v1.11.0) (2026-07-15)


### Features

* show the cycle path in suggest and add ignoreReExports option ([13ea199](https://github.com/ariusxi/artie-lens/commit/13ea1995b5b8e64f2097f73ffd5844a04818b29e))

## [1.10.1](https://github.com/ariusxi/artie-lens/compare/v1.10.0...v1.10.1) (2026-07-15)


### Bug Fixes

* exclude type-only imports from the module dependency graph ([b2559ba](https://github.com/ariusxi/artie-lens/commit/b2559ba455f3e8818e487e47a0715a1f0957d880))

# [1.10.0](https://github.com/ariusxi/artie-lens/compare/v1.9.0...v1.10.0) (2026-07-15)


### Features

* add watch/suggest/hotspots subcommands and split docs into docs/ ([c209973](https://github.com/ariusxi/artie-lens/commit/c209973a4b46856ff2089b9c1ad468a436a93449))

# [1.9.0](https://github.com/ariusxi/artie-lens/compare/v1.8.0...v1.9.0) (2026-07-14)


### Features

* enforce declarative architecture rules from the import graph ([c640ba4](https://github.com/ariusxi/artie-lens/commit/c640ba4398f6e429c2d62cb2facd399ff310bc7a))

# [1.8.0](https://github.com/ariusxi/artie-lens/compare/v1.7.1...v1.8.0) (2026-07-14)


### Features

* add --hotspots ranking files by structural badness times git churn ([4c0cace](https://github.com/ariusxi/artie-lens/commit/4c0cace3acec6772444cd91549afb02dc94c7eed))

## [1.7.1](https://github.com/ariusxi/artie-lens/compare/v1.7.0...v1.7.1) (2026-07-06)


### Performance Improvements

* build one shared ts-morph project per run instead of one per metric ([8c050ea](https://github.com/ariusxi/artie-lens/commit/8c050ea5398c68255d6ccf03a21927baffa1914b))

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
