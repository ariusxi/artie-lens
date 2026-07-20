import { Node } from 'ts-morph'

export const isFunctionInitializer = (node: Node | undefined): boolean =>
  !!node && (Node.isArrowFunction(node) || Node.isFunctionExpression(node))
