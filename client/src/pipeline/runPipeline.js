// runPipeline — Orchestrates all pipeline steps in sequence. Checks the cancel token between
// each step so a new Compose click immediately stops the current run.

import { parseMarkdown }   from './parseMarkdown.js'
import { normalizeBlocks } from './normalizeBlocks.js'
import { resolveStyles }   from './resolveStyles.js'
import { measureBlocks }   from './measureBlocks.js'
import { validateBlocks }  from './validateBlocks.js'
import { paginate }        from './paginate.js'

export class PipelineCancelledError extends Error {}

export async function runPipeline({
  styleSettings,
  marginSettings,
  cancelToken,
  log,
  onNormalizedBlocks,
  onResolvedStyles,
  onMeasuredBlocks,
  onValidationIssues,
  onPageReady,
  onDone,
}) {
  function check() {
    if (cancelToken.cancelled) throw new PipelineCancelledError()
  }

  // 1. Parse
  check()
  const raw = await parseMarkdown(log)

  // 2. Normalize
  check()
  const normalized = normalizeBlocks(raw, log)
  onNormalizedBlocks(normalized)

  // 3. Resolve styles
  check()
  const resolved = resolveStyles(styleSettings, marginSettings, log)
  onResolvedStyles(resolved)

  // 4. Measure
  check()
  const measured = await measureBlocks(normalized, resolved, log)
  onMeasuredBlocks(measured)

  // 5. Validate
  check()
  const issues = validateBlocks(measured, resolved, log)
  onValidationIssues(issues)

  // 6. Paginate
  check()
  const pages = paginate(measured, resolved, issues, log, onPageReady)

  onDone({ pages })
}
