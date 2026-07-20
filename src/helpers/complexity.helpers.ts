import { ClassDeclaration, Node, SyntaxKind } from 'ts-morph'

import { isFunctionInitializer } from './ast.helpers'

const DECISION_KINDS = [
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.CatchClause,
]

const LOGICAL_OPERATORS = [
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.QuestionQuestionToken,
]

const getMethodComplexity = (method: Node): number => {
  let complexity = 1

  for (const kind of DECISION_KINDS) {
    complexity += method.getDescendantsOfKind(kind).length
  }

  for (const binary of method.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const operator = binary.getOperatorToken().getKind()
    if (LOGICAL_OPERATORS.includes(operator)) complexity += 1
  }

  return complexity
}

export const getWeightedMethods = (classDeclaration: ClassDeclaration): number => {
  const methods: Node[] = [
    ...classDeclaration.getConstructors(),
    ...classDeclaration.getMethods().filter((method) => !method.isOverload()),
    ...classDeclaration.getGetAccessors(),
    ...classDeclaration.getSetAccessors(),
  ]

  for (const property of classDeclaration.getProperties()) {
    if (property.isStatic() || !isFunctionInitializer(property.getInitializer())) continue
    methods.push(property.getInitializerOrThrow())
  }

  return methods.reduce((total, method) => total + getMethodComplexity(method), 0)
}
