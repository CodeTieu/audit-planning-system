/**
 * Schema-driven risk trigger evaluator (frontend mirror).
 *
 * For each section/question, looks at the question's `triggers` array (if any)
 * and the question's `risk_polarity` flag, and returns an array of "triggered"
 * risk descriptors to render in RiskBanner components.
 *
 * The backend evaluates the same rules authoritatively when the workpaper
 * is saved. This frontend evaluator is purely cosmetic — it gives the auditor
 * immediate visual feedback without waiting for a server round-trip.
 */

function evaluateMatch(trigger, value, formData) {
  const kind = trigger.match_kind || (trigger.match && trigger.match.kind)

  // Table-row matcher: any_row_field_equals
  if (kind === 'any_row_field_equals' && Array.isArray(value)) {
    return value.some((row) => row && row[trigger.match_field] === trigger.match_value)
  }

  // Simple value match (Yes/No/etc.)
  if (kind === 'value_equals') {
    return value === trigger.match_value
  }

  // Convenience: question with risk_polarity instead of explicit triggers
  // (handled below in evaluateQuestion)
  return false
}

/**
 * Return array of triggered risk descriptors for a single question.
 * Each descriptor: { id, description, severity, pervasive, questionRef }
 */
export function evaluateQuestionTriggers(question, value, formData) {
  const fired = []

  // Explicit triggers array on the question
  if (Array.isArray(question.triggers)) {
    for (const t of question.triggers) {
      if (evaluateMatch(t, value, formData)) {
        fired.push({
          id: t.id,
          description: t.risk_description,
          severity: (t.severity || 'medium').toLowerCase(),
          pervasive: !!t.is_pervasive,
          questionRef: question.id,
        })
      }
    }
  }

  // Polarity-based: question.risk_polarity = 'no' means a 'no' answer triggers
  if (question.risk_polarity && value && !question.is_descriptive) {
    const polarity = String(question.risk_polarity).toLowerCase()
    const lowered = String(value).toLowerCase()
    if (lowered === polarity) {
      fired.push({
        id: `${question.id}_POLARITY`,
        description: question.risk_description || `${question.text} — answer triggers a risk.`,
        severity: (question.severity || 'medium').toLowerCase(),
        pervasive: !!question.is_pervasive,
        questionRef: question.id,
      })
    }
  }

  return fired
}

/** Return all triggered risk descriptors across the entire schema. */
export function evaluateAllTriggers(schema, formData) {
  const all = []
  if (!schema || !Array.isArray(schema.sections)) return all
  for (const sec of schema.sections) {
    for (const q of (sec.questions || [])) {
      const fired = evaluateQuestionTriggers(q, formData[q.id], formData)
      all.push(...fired)
    }
  }
  return all
}
