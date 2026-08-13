export function hasMeaningfulSlotContent(nodes: Iterable<Node>): boolean {
  return [...nodes].some((node) => {
    if (node instanceof HTMLSlotElement) {
      return hasMeaningfulSlotContent(node.assignedNodes({ flatten: true }))
    }
    return node.nodeType === Node.ELEMENT_NODE || (node.textContent?.trim().length ?? 0) > 0
  })
}
