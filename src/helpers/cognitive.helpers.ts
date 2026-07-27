import { ClassDeclaration, Node, SyntaxKind } from 'ts-morph'

import { isFunctionInitializer } from './ast.helpers'

// Cognitive complexity (Campbell / SonarSource): unlike cyclomatic complexity it does not just
// count branches, it punishes how hard the code is to *read*. Each control-flow structure adds one,
// plus one for every level of nesting it sits inside, so deeply nested logic costs far more than a
// flat sequence of the same statements.

const LOOP_KINDS = new Set<SyntaxKind>([
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
])

const NESTED_FUNCTION_KINDS = new Set<SyntaxKind>([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.ArrowFunction,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.Constructor,
  SyntaxKind.GetAccessor,
  SyntaxKind.SetAccessor,
])

const LOGICAL_TOKENS = new Set<SyntaxKind>([SyntaxKind.AmpersandAmpersandToken, SyntaxKind.BarBarToken])

const isLogical = (node: Node): boolean =>
  Node.isBinaryExpression(node) && LOGICAL_TOKENS.has(node.getOperatorToken().getKind())

// One increment per boolean sequence, not per operator: `a && b && c` is one, `a && b || c` is two.
// A logical node only counts when its parent is not the same operator continuing the sequence.
const startsLogicalSequence = (node: Node): boolean => {
  if (!isLogical(node) || !Node.isBinaryExpression(node)) return false
  const parent = node.getParent()
  if (parent && isLogical(parent) && Node.isBinaryExpression(parent)) {
    return parent.getOperatorToken().getKind() !== node.getOperatorToken().getKind()
  }
  return true
}

const hasLabel = (node: Node): boolean =>
  (Node.isBreakStatement(node) || Node.isContinueStatement(node)) && node.getLabel() !== undefined

const bodyOf = (fn: Node): Node | undefined => {
  const candidate = fn as unknown as { getBody?: () => Node | undefined }
  return typeof candidate.getBody === 'function' ? candidate.getBody() : undefined
}

const methodCognitive = (fn: Node): number => {
  const body = bodyOf(fn)
  if (!body) return 0

  let total = 0

  // An if / else-if / else chain: the leading `if` pays the nesting penalty, each `else if` and the
  // final `else` add a flat one, and every branch body is visited one level deeper.
  const visitIf = (node: Node, nesting: number): void => {
    let current: Node | undefined = node
    let leading = true
    while (current && Node.isIfStatement(current)) {
      total += leading ? 1 + nesting : 1
      leading = false
      visit(current.getExpression(), nesting)
      visit(current.getThenStatement(), nesting + 1)

      const elseStatement = current.getElseStatement()
      if (!elseStatement) return
      if (Node.isIfStatement(elseStatement)) {
        current = elseStatement
        continue
      }
      total += 1
      visit(elseStatement, nesting + 1)
      return
    }
  }

  const visit = (node: Node | undefined, nesting: number): void => {
    if (!node) return
    const kind = node.getKind()

    if (kind === SyntaxKind.IfStatement) return visitIf(node, nesting)

    if (LOOP_KINDS.has(kind) || kind === SyntaxKind.SwitchStatement || kind === SyntaxKind.CatchClause || kind === SyntaxKind.ConditionalExpression) {
      total += 1 + nesting
      node.forEachChild((child) => visit(child, nesting + 1))
      return
    }

    if (NESTED_FUNCTION_KINDS.has(kind)) {
      node.forEachChild((child) => visit(child, nesting + 1))
      return
    }

    if (startsLogicalSequence(node)) total += 1
    if (hasLabel(node)) total += 1

    node.forEachChild((child) => visit(child, nesting))
  }

  body.forEachChild((child) => visit(child, 0))
  return total
}

const classFunctions = (classDeclaration: ClassDeclaration): Node[] => {
  const functions: Node[] = [
    ...classDeclaration.getConstructors(),
    ...classDeclaration.getMethods().filter((method) => !method.isOverload()),
    ...classDeclaration.getGetAccessors(),
    ...classDeclaration.getSetAccessors(),
  ]

  for (const property of classDeclaration.getProperties()) {
    if (property.isStatic() || !isFunctionInitializer(property.getInitializer())) continue
    functions.push(property.getInitializerOrThrow())
  }

  return functions
}

export const getCognitiveComplexity = (classDeclaration: ClassDeclaration): number =>
  classFunctions(classDeclaration).reduce((total, fn) => total + methodCognitive(fn), 0)
