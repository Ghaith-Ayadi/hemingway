// runPipeline — Orchestrates all pipeline steps in sequence. Checks the cancel token between each step.
// Accepts notionPageId (fetch source) or cachedBlocks (skip fetch+normalize for Restyle).

import { parseMarkdown }   from './parseMarkdown.js'
import { fetchNotion }     from './fetchNotion.js'
import { normalizeBlocks } from './normalizeBlocks.js'
import { resolveStyles }   from './resolveStyles.js'
import { measureBlocks }   from './measureBlocks.js'
import { validateBlocks }  from './validateBlocks.js'
import { paginate }        from './paginate.js'

export class PipelineCancelledError extends Error {}

export async function runPipeline({
  styleSettings,
  marginSettings,
  notionPageId,
  cachedBlocks,
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

  let normalized

  if (cachedBlocks) {
    // Restyle path: skip fetch + normalize, use cached blocks from the last Compose
    log({ step: 'restyle', message: `Using ${cachedBlocks.length} cached blocks — skipping fetch`, type: 'info' })
    normalized = cachedBlocks
  } else {
    // Full path: fetch source + normalize
    check()
    log({
      step: 'runPipeline',
      message: notionPageId ? `Source: Notion (${notionPageId})` : 'Source: testfile.md',
      type: 'info',
    })
    const raw = notionPageId
      ? await fetchNotion(notionPageId, log)
      : await parseMarkdown(log)

    check()
    normalized = normalizeBlocks(raw, log)
    onNormalizedBlocks(normalized)
  }

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
  const pages = await paginate(measured, resolved, issues, log, onPageReady)

  onDone({ pages })
}
