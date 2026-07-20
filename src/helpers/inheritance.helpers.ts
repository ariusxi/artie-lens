import { ClassDeclaration } from 'ts-morph'

export const getDepthOfInheritance = (classDeclaration: ClassDeclaration): number => {
  let depth = 0
  let current = classDeclaration.getBaseClass()

  while (current) {
    depth += 1
    current = current.getBaseClass()
  }

  return depth
}

export const getNumberOfChildren = (classDeclaration: ClassDeclaration): number =>
  // getDerivedClasses() returns all descendants; keep only immediate children
  classDeclaration
    .getDerivedClasses()
    .filter((derived) => derived.getBaseClass() === classDeclaration)
    .length
