// validateBlocks — Runs after measureBlocks. Flags giant blocks (height > 90% of contentHeight)
// and blocks with nested children. Does not block pipeline execution.

export function validateBlocks(measuredBlocks, resolvedStyles, log) {
  log({ step: 'validateBlocks', message: 'Scanning blocks…', type: 'info' })

  const issues = []
  const giantThreshold = resolvedStyles.contentHeight * 0.9

  for (const block of measuredBlocks) {
    if (block.hasNested) {
      const issue = {
        blockId: block.id,
        type: 'unsupported_nesting',
        message: `⚠️ Block ${block.id} (${block.type}) has nested content — children skipped`,
      }
      issues.push(issue)
      log({ step: 'validateBlocks', message: issue.message, type: 'warning' })
    }

    if (block.height > giantThreshold) {
      const issue = {
        blockId: block.id,
        type: 'giant_block',
        message: `⚠️ Block ${block.id} (${block.type}) is ${Math.round(block.height)}px — exceeds 90% of page height (${Math.round(giantThreshold)}px)`,
      }
      issues.push(issue)
      log({ step: 'validateBlocks', message: issue.message, type: 'warning' })
    }
  }

  if (issues.length === 0) {
    log({ step: 'validateBlocks', message: 'No issues found', type: 'info' })
  } else {
    log({ step: 'validateBlocks', message: `${issues.length} issue(s) found`, type: 'warning' })
  }

  return issues
}
