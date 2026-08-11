export function hasMeaningfulSlotContent(nodes: Iterable<Node>): boolean {
  return [...nodes].some(
    (node) => node.nodeType === Node.ELEMENT_NODE || (node.textContent?.trim().length ?? 0) > 0,
  )
}
