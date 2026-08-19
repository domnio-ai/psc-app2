export type FelixVisualState =
  | 'idle' | 'thinking' | 'searching' | 'reading' | 'auditing'
  | 'found_issue' | 'suggesting' | 'success' | 'insufficient_evidence'
  | 'presenting' | 'error'

export type FelixOperation =
  | 'app2_operation' | 'knowledge_search' | 'document_summary'
  | 'document_audit' | 'research_synthesis' | 'general'

export const FELIX_STATUS_TEXT: Record<FelixVisualState, string> = {
  idle: 'Felix is available', thinking: 'Felix is preparing the response…',
  searching: 'Felix is searching App2…', reading: 'Felix is reading the document…',
  auditing: 'Felix is auditing this document…', found_issue: 'Felix found a possible gap.',
  suggesting: 'Felix has a suggestion.', success: 'Felix completed the request.',
  insufficient_evidence: 'The available evidence is insufficient.',
  presenting: 'Felix is presenting the analysis.', error: 'Felix encountered a technical problem.',
}

export function inferFelixOperation(question: string, documentId?: string): FelixOperation {
  const value = question.toLowerCase()
  if (/audit|check methodology|check evidence|find gaps|identify risks/.test(value)) return 'document_audit'
  if (documentId || /summari[sz]e.*document|review.*document/.test(value)) return 'document_summary'
  if (/find|search|related|research about|previous stud/.test(value)) return 'knowledge_search'
  if (/synthesi[sz]e|compare.*research|analyse research/.test(value)) return 'research_synthesis'
  if (/assignment|show my|list my|pending|overdue/.test(value)) return 'app2_operation'
  return 'general'
}
