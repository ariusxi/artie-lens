# Metrics

Every metric produces a value, a label (`OK` / `WARNING` / `CRITICAL`) and an actionable hint.
Higher values mean higher complexity or risk.

## Class metrics (the CK suite)

Measured **per class**, following _A Metrics Suite for Object Oriented Design_
(Chidamber & Kemerer, IEEE TSE, 1994).

| Metric | Name | What it measures | High value suggests |
| --- | --- | --- | --- |
| **WMC** | Weighted Methods per Class | Sum of the cyclomatic complexity of each method (constructors, accessors and arrow-function fields included). With trivial methods it equals the method count. | The class is doing too much; hard to test and maintain. |
| **DIT** | Depth of Inheritance Tree | Length of the `extends` chain up to the root (a root class is `0`). | Behavior is harder to predict; many inherited methods. |
| **NOC** | Number of Children | Number of **immediate** subclasses (direct children only). | Possible misuse of subclassing or a leaky base abstraction. |
| **CBO** | Coupling Between Object classes | Number of **other classes** the class depends on, via heritage, parameter/property/return types, and usages inside method bodies (`new`, calls, member access). | Fragile design; changes elsewhere ripple in. |
| **RFC** | Response For a Class | Size of the response set: the class's own methods **plus** the first-level methods they call. | Testing and debugging are harder; many methods can run per message. |
| **LCOM** | Lack of Cohesion in Methods | Pairs of methods that share **no** instance variable, minus the pairs that do (floored at 0). `0` when methods are cohesive or use no instance state. | The class mixes unrelated responsibilities; consider splitting (SRP). |

## Module metrics

Measured **per module** (file), so they apply to any TypeScript, including functional code
with no classes at all. The reported value is the module path.

| Metric | Name | What it measures | High value suggests |
| --- | --- | --- | --- |
| **CE** | Efferent Coupling | Number of distinct project modules the file imports (via `import` and `export ... from`). | The module is fragile to upstream changes; a coupling hub. |
| **CYCLIC** | Circular dependency | Size of the import cycle the module belongs to (`0` when acyclic), found with Tarjan's SCC. | An import cycle: hard to test, build, and reason about. |
| **DISTANCE** | Distance from the main sequence | Robert Martin's `D = \|A + I - 1\|`, scaled to `0..100`. `A` is abstractness (interfaces and abstract classes over all types), `I` is instability (`Ce / (Ca + Ce)`). | A concrete module everyone depends on (hard to change) or an abstract module nobody uses (dead weight). |

## Scope and known limitations

Being explicit here matters more than looking complete.

- **CBO** is **efferent** (fan-out) only: it counts what a class depends on, not what depends
  on it. It does **not** count coupling to `interface`s, only concrete classes.
- **WMC** uses cyclomatic complexity as the per-method weight (the paper deliberately leaves
  the weight open). Static methods are included.
- **RFC** counts the first level of method calls only (as in the paper) and excludes calls to
  library, `node_modules` and declaration-file functions (for example `console.log`).
- **LCOM** excludes static methods, counts constructor **parameter properties** as instance
  variables, and does not track destructuring access (`const { x } = this`).
- **DIT** follows the `extends` chain and counts every ancestor class it can resolve, including
  external base classes when they are declared as classes in the available typings.
- **NOC** counts immediate subclasses found **within the analyzed project** only.
- **CE** and **CYCLIC** measure the **runtime** module graph: they resolve relative imports
  and `tsconfig` path aliases, ignore external (`node_modules`) imports, and ignore type-only
  imports (`import type`, and `import { type X }`) since those are erased at compile time.
  Re-exports (`export * from`) still count, so barrel files can inflate cycle sizes. Set
  `options.ignoreReExports` to drop them, and use `artie suggest` to see the actual cycle path.
