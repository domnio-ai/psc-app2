import { useEffect, useRef, useState } from 'react'
import type {
  AiResearchEngine,
  AiResearchJob,
  ChangeProposal,
  FelixAction,
  FelixFinding,
  FelixMode,
  FelixResponse,
} from './api'

type Message = {
  role: 'assistant' | 'user'
  text: string
  references?: string[]
  action?: FelixAction
  actionDone?: boolean
  report?: boolean
  mode?: FelixMode
  confidence?: string
  findings?: FelixFinding[]
}

type ReviewRequest = {
  documentId: string
  title: string
  nonce: number
}

type Props = {
  engine: AiResearchEngine | null
  jobs: AiResearchJob[]
  userRole: string
  reviewRequest?: ReviewRequest | null

  onAsk: (
    question: string,
    history: {
      role: 'user' | 'assistant'
      content: string
    }[],
    mode: FelixMode
  ) => Promise<FelixResponse>

  onAction: (
    action: FelixAction
  ) => Promise<string>

  onListProposals: () => Promise<ChangeProposal[]>

  onCreateProposal: (
    findingId: string
  ) => Promise<ChangeProposal>

  onDecideProposal: (
    id: string,
    decision: 'Approved' | 'Rejected',
    comments: string
  ) => Promise<ChangeProposal>
}

/* =========================================================
   FELIX TEXT CLEANER
   Removes old encoding artifacts before rendering.
   ========================================================= */

function cleanFelixText(value: string) {
  return value
    .replace(/â€¢/g, '-')
    .replace(/â€”/g, '-')
    .replace(/â€“/g, '-')
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€™/g, "'")
    .replace(/â€¦/g, '...')
    .replace(/Â·/g, '-')
    .replace(/âœ“/g, '')
}

/* =========================================================
   FELIX ANSWER RENDERER
   Separates titles, section headings, bullets and normal text.
   ========================================================= */

function renderFelixText(value: string) {
  const cleaned = cleanFelixText(value)

  const sectionNames = [
    'purpose',
    'what it stores',
    'how it works',
    'status flow',
    'summary',
    'key points',
    'requirements',
    'process',
    'steps',
    'workflow',
    'access',
    'documents',
    'felix integration',
    'assignment links',
    'contents',
    'overview',
    'features',
    'functions',
    'approval process',
    'review process',
    'next steps',
    'recommendations',
    'limitations',
    'confidence',
    'sources',
    'evidence',
  ]

  return cleaned
    .split(/\r?\n/)
    .map((raw, index) => {
      const line = raw.trim()

      if (!line) {
        return (
          <div
            className="felix-answer-space"
            key={index}
          />
        )
      }

      /*
       * Main title:
       * KNOWLEDGE REPOSITORY
       * HOW TO UPLOAD A DOCUMENT
       */
      if (
        /^[A-Z][A-Z0-9 &/()'-]{3,}$/.test(line)
      ) {
        return (
          <h4
            className="felix-answer-title"
            key={index}
          >
            {line}
          </h4>
        )
      }

      /*
       * Remove bullets or numbering temporarily so
       * a heading like "- Purpose" is still identified
       * as a section heading.
       */
      const plainSection = line
        .replace(/^[-*]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/:$/, '')
        .trim()

      if (
        sectionNames.includes(
          plainSection.toLowerCase()
        )
      ) {
        return (
          <h5
            className="felix-answer-section"
            key={index}
          >
            {plainSection}
          </h5>
        )
      }

      /*
       * Bullet item
       */
      if (/^[-*]\s+/.test(line)) {
        return (
          <div
            className="felix-answer-bullet"
            key={index}
          >
            <span>-</span>

            <p>
              {line.replace(
                /^[-*]\s+/,
                ''
              )}
            </p>
          </div>
        )
      }

      /*
       * Numbered step
       */
      if (/^\d+\.\s+/.test(line)) {
        const match = line.match(
          /^(\d+\.)\s+(.*)$/
        )

        return (
          <div
            className="felix-answer-step"
            key={index}
          >
            <strong>
              {match?.[1]}
            </strong>

            <p>
              {match?.[2] || line}
            </p>
          </div>
        )
      }

      /*
       * Normal explanation text
       */
      return (
        <p
          className="felix-answer-body"
          key={index}
        >
          {line}
        </p>
      )
    })
}

/* =========================================================
   CHAT COMPONENT
   ========================================================= */

export default function AIResearchChat({
  engine,
  jobs,
  userRole,
  reviewRequest,
  onAsk,
  onAction,
  onListProposals,
  onCreateProposal,
  onDecideProposal,
}: Props) {

  const [
    question,
    setQuestion,
  ] = useState('')

  const [
    mode,
    setMode,
  ] = useState<FelixMode>('Auto')

  const [
    sending,
    setSending,
  ] = useState(false)

  const [
    proposals,
    setProposals,
  ] = useState<ChangeProposal[]>([])

  const [
    proposalNotice,
    setProposalNotice,
  ] = useState('')

  const [
    messages,
    setMessages,
  ] = useState<Message[]>([
    {
      role: 'assistant',
      text:
        'Hello, I am Felix, your PSC AI Research Assistant. ' +
        'Ask me about App2, approved documents, assignments, research or institutional knowledge.',
    },
  ])

  const messageListRef =
    useRef<HTMLDivElement>(null)

  const questionInputRef =
    useRef<HTMLTextAreaElement>(null)

  /* =======================================================
     PROPOSALS
     ======================================================= */

  const refreshProposals = () =>
    onListProposals()
      .then(setProposals)
      .catch(() =>
        setProposals([])
      )

  useEffect(() => {
    if (
      [
        'Administrator',
        'Research Manager',
      ].includes(userRole)
    ) {
      refreshProposals()
    }
  }, [userRole])

  /* =======================================================
     AUTO SCROLL
     ======================================================= */

  useEffect(() => {
    const frame =
      window.requestAnimationFrame(
        () => {
          const list =
            messageListRef.current

          if (list) {
            list.scrollTo({
              top: list.scrollHeight,
              behavior: 'smooth',
            })
          }
        }
      )

    return () =>
      window.cancelAnimationFrame(
        frame
      )
  }, [messages, sending])

  /* =======================================================
     DOCUMENT REVIEW REQUEST
     ======================================================= */

  useEffect(() => {
    if (!reviewRequest) return

    setMode('Research')

    setQuestion(
      `Review the approved document "${reviewRequest.title}". ` +
        'Summarize its key points, identify risks or gaps, ' +
        'and recommend follow-up actions. ' +
        'Use only approved App2 evidence and cite the document.'
    )

    window.requestAnimationFrame(
      () => {
        questionInputRef.current?.focus()
      }
    )
  }, [reviewRequest?.nonce])

  /* =======================================================
     SEND MESSAGE
     ======================================================= */

  const send = async () => {
    const text =
      question.trim()

    if (
      !text ||
      sending
    ) {
      return
    }

    /*
     * Conversation history is sent separately.
     * Do NOT append history to the current question.
     *
     * This prevents phrases in old Felix answers
     * from incorrectly triggering fast-path routing.
     */
    const history =
      messages.map((item) => ({
        role: item.role,
        content: item.text,
      }))

    setQuestion('')

    setMessages(
      (current) => [
        ...current,
        {
          role: 'user',
          text,
          mode,
        },
      ]
    )

    setSending(true)

    try {

      /*
       * IMPORTANT:
       * There must be only ONE call to onAsk().
       */
      const response =
        await onAsk(
          text,
          history,
          mode
        )

      const safeMessage: Message = {
        role: 'assistant',

        text:
          typeof response.answer ===
            'string' &&
          response.answer.trim()
            ? cleanFelixText(
                response.answer
              )
            : 'Felix completed the request but returned no readable answer.',

        references:
          Array.isArray(
            response.references
          )
            ? response.references
                .filter(
                  (item) =>
                    typeof item ===
                    'string'
                )
                .map(
                  (item) =>
                    cleanFelixText(
                      item
                    )
                )
            : [],

        action:
          response.action &&
          typeof response.action ===
            'object'
            ? response.action
            : undefined,

        report:
          Boolean(
            response.report
          ),

        mode:
          response.mode,

        confidence:
          typeof response.confidence ===
          'string'
            ? response.confidence
            : undefined,

        findings:
          Array.isArray(
            response.findings
          )
            ? response.findings
            : [],
      }

      setMessages(
        (current) => [
          ...current,
          safeMessage,
        ]
      )

      if (
        response.mode ===
        'Code Review'
      ) {
        refreshProposals()
      }

    } catch (error) {

      setMessages(
        (current) => [
          ...current,
          {
            role: 'assistant',

            text:
              error instanceof Error
                ? error.message
                : 'I could not answer that just now. Please try again.',

            mode,
          },
        ]
      )

    } finally {
      setSending(false)
    }
  }

  /* =======================================================
     CONFIRM FELIX ACTION
     ======================================================= */

  const confirmAction = async (
    index: number,
    action: FelixAction
  ) => {

    setSending(true)

    try {
      const result =
        await onAction(
          action
        )

      setMessages(
        (current) =>
          current.map(
            (
              item,
              itemIndex
            ) =>
              itemIndex === index
                ? {
                    ...item,

                    actionDone:
                      true,

                    text:
                      `${item.text}\n\n${result}`,
                  }
                : item
          )
      )

    } catch (error) {

      setMessages(
        (current) =>
          current.map(
            (
              item,
              itemIndex
            ) =>
              itemIndex === index
                ? {
                    ...item,

                    text:
                      `${item.text}\n\n` +
                      (
                        error instanceof
                        Error
                          ? error.message
                          : 'The action could not be completed.'
                      ),
                  }
                : item
          )
      )

    } finally {
      setSending(false)
    }
  }

  /* =======================================================
     CREATE PATCH PROPOSAL
     ======================================================= */

  const propose = async (
    findingId: string
  ) => {

    setSending(true)
    setProposalNotice('')

    try {

      await onCreateProposal(
        findingId
      )

      setProposalNotice(
        'Patch proposal created for independent approval. No code was applied.'
      )

      await refreshProposals()

    } catch (error) {

      setProposalNotice(
        error instanceof Error
          ? error.message
          : 'The proposal could not be created.'
      )

    } finally {
      setSending(false)
    }
  }

  /* =======================================================
     APPROVE / REJECT PROPOSAL
     ======================================================= */

  const decide = async (
    proposal: ChangeProposal,
    decision:
      | 'Approved'
      | 'Rejected'
  ) => {

    const comments =
      window.prompt(
        `${decision} comments`
      )

    if (
      !comments?.trim()
    ) {
      return
    }

    setSending(true)

    try {

      await onDecideProposal(
        proposal.id,
        decision,
        comments.trim()
      )

      setProposalNotice(
        `${decision}. The patch remains Not Applied.`
      )

      await refreshProposals()

    } catch (error) {

      setProposalNotice(
        error instanceof Error
          ? error.message
          : 'The decision could not be recorded.'
      )

    } finally {
      setSending(false)
    }
  }

  /* =======================================================
     DOWNLOAD REPORT
     ======================================================= */

  const downloadReport = (
    content: string
  ) => {

    const url =
      URL.createObjectURL(
        new Blob(
          [content],
          {
            type:
              'text/plain;charset=utf-8',
          }
        )
      )

    const link =
      document.createElement(
        'a'
      )

    link.href = url

    link.download =
      `app2-report-${new Date()
        .toISOString()
        .slice(
          0,
          10
        )}.txt`

    link.click()

    URL.revokeObjectURL(
      url
    )
  }

  /* =======================================================
     UI
     ======================================================= */

  return (
    <div className="ai-chat-layout">

      <section className="ai-chat">

        {/* HEADER */}

        <header>

          <div>

            <strong>
              Chat with Felix
            </strong>

            <small>
              App2-aware AI assistant
            </small>

          </div>

          <b
            className={
              engine?.ollamaConnected
                ? 'online'
                : 'offline'
            }
          >
            {
              engine?.ollamaConnected
                ? 'Local AI online'
                : 'Local AI offline'
            }
          </b>

        </header>

        {/* MODE SELECTOR */}

        <div className="felix-mode-picker">

          <label>

            Operating mode

            <select
              value={mode}
              onChange={
                (event) =>
                  setMode(
                    event.target
                      .value as FelixMode
                  )
              }
            >
              <option>
                Auto
              </option>

              <option>
                Research
              </option>

              <option>
                App2 Expert
              </option>

              <option>
                Code Review
              </option>

            </select>

          </label>

          <small>
            {
              mode ===
              'Code Review'
                ? 'Read-only controlled checks - no automatic fixes'

                : mode ===
                  'App2 Expert'
                  ? 'Live App2 technical and repository evidence'

                  : mode ===
                    'Research'
                    ? 'Grounded document retrieval and citations'

                    : 'Felix automatically selects the appropriate App2 workflow'
            }
          </small>

        </div>

        {/* CONVERSATION */}

        <div
          className="ai-chat-messages"
          ref={messageListRef}
          aria-live="polite"
        >

          {
            messages.map(
              (
                message,
                index
              ) => (

                <article
                  className={
                    message.role
                  }
                  key={index}
                >

                  <span>
                    {
                      message.role ===
                      'assistant'
                        ? 'Felix'
                        : 'You'
                    }
                  </span>

                  <div className="ai-message-content">

                    {
                      message.mode
                        ? (
                          <small className="felix-mode-label">
                            {
                              message.mode
                            }
                          </small>
                        )
                        : null
                    }

                    {
                      message.role ===
                      'assistant'
                        ? (
                          <div className="felix-answer">

                            {
                              renderFelixText(
                                message.text
                              )
                            }

                          </div>
                        )
                        : (
                          <p>
                            {
                              message.text
                            }
                          </p>
                        )
                    }

                    {/* CONFIDENCE */}

                    {
                      message.confidence
                        ? (
                          <small className="felix-confidence">

                            Confidence:{' '}

                            {
                              message.confidence
                            }

                          </small>
                        )
                        : null
                    }

                    {/* CODE REVIEW FINDINGS */}

                    {
                      message.findings?.map(
                        (
                          finding
                        ) => (

                          <div
                            className="felix-finding"
                            key={
                              finding.finding_id
                            }
                          >

                            <strong>
                              {
                                finding.finding_id
                              }
                              {' - '}
                              {
                                finding.severity
                              }
                            </strong>

                            <small>
                              {
                                finding.file_path
                              }
                              :
                              {
                                finding.start_line
                              }
                            </small>

                            <button
                              disabled={
                                sending ||
                                Boolean(
                                  finding.proposed_patch
                                )
                              }
                              onClick={
                                () =>
                                  propose(
                                    finding.finding_id
                                  )
                              }
                            >
                              {
                                finding.proposed_patch
                                  ? 'Proposal exists'
                                  : 'Propose patch'
                              }
                            </button>

                          </div>
                        )
                      )
                    }

                    {/* EVIDENCE */}

                    {
                      message.references?.length
                        ? (
                          <details className="felix-references">

                            <summary>
                              Evidence (
                              {
                                message.references.length
                              }
                              )
                            </summary>

                            {
                              message.references.map(
                                (
                                  reference,
                                  referenceIndex
                                ) => (

                                  <code
                                    key={
                                      referenceIndex
                                    }
                                  >
                                    {
                                      reference
                                    }
                                  </code>

                                )
                              )
                            }

                          </details>
                        )
                        : null
                    }

                    {/* REPORT */}

                    {
                      message.report
                        ? (
                          <button
                            className="felix-download-report"
                            onClick={
                              () =>
                                downloadReport(
                                  message.text
                                )
                            }
                          >
                            Download report
                          </button>
                        )
                        : null
                    }

                    {/* PROPOSED ACTION */}

                    {
                      message.action &&
                      !message.actionDone
                        ? (
                          <button
                            className="felix-confirm-action"
                            disabled={
                              sending
                            }
                            onClick={
                              () =>
                                confirmAction(
                                  index,
                                  message.action!
                                )
                            }
                          >
                            {
                              message.action.label
                            }
                          </button>
                        )
                        : null
                    }

                    {
                      message.actionDone
                        ? (
                          <small className="felix-action-done">
                            Action confirmed
                          </small>
                        )
                        : null
                    }

                  </div>

                </article>

              )
            )
          }

          {/* WORKING INDICATOR */}

          {
            sending
              ? (
                <article className="assistant">

                  <span>
                    Felix
                  </span>

                  <div className="ai-message-content">

                    <div className="felix-answer">

                      <p className="felix-answer-body">
                        Working...
                      </p>

                    </div>

                  </div>

                </article>
              )
              : null
          }

        </div>

        {/* MESSAGE COMPOSER */}

        <div className="ai-chat-input">

          <textarea
            ref={
              questionInputRef
            }
            value={
              question
            }
            onChange={
              (event) =>
                setQuestion(
                  event.target.value
                )
            }
            onKeyDown={
              (event) => {

                if (
                  event.key ===
                    'Enter' &&
                  !event.shiftKey
                ) {

                  event.preventDefault()

                  send()
                }
              }
            }
            placeholder={
              mode ===
              'Code Review'
                ? 'Describe the controlled App2 review...'

                : mode ===
                  'App2 Expert'
                  ? 'Ask about App2 modules, APIs, permissions, tests or code...'

                  : mode ===
                    'Research'
                    ? 'Ask Felix to research approved App2 evidence...'

                    : 'Message Felix...'
            }
          />

          <button
            onClick={
              send
            }
            disabled={
              !question.trim() ||
              sending
            }
          >
            Send
          </button>

        </div>

        <small className="ai-chat-scope">
          Felix uses your App2 permissions.
          Expert and Code Review modes are read-only.
        </small>

      </section>

      {/* RIGHT SIDE PANEL */}

      <aside className="ai-chat-history">

        <h3>
          Manual approvals
        </h3>

        {
          proposalNotice
            ? (
              <p>
                {
                  proposalNotice
                }
              </p>
            )
            : null
        }

        {
          proposals
            .slice(
              0,
              8
            )
            .map(
              (
                proposal
              ) => (

                <article
                  key={
                    proposal.id
                  }
                >

                  <span>
                    {
                      proposal.status
                    }
                    {' - '}
                    {
                      proposal.application_status
                    }
                  </span>

                  <strong>
                    {
                      proposal.finding_id
                    }
                  </strong>

                  <small>
                    {
                      proposal.file_path
                    }
                    {' - proposed by '}
                    {
                      proposal.proposed_by_name
                    }
                  </small>

                  <details>

                    <summary>
                      Review patch
                    </summary>

                    <pre>
                      {
                        proposal.patch
                      }
                    </pre>

                  </details>

                  {
                    proposal.status ===
                      'Pending Approval' &&
                    userRole ===
                      'Administrator'
                      ? (
                        <div className="proposal-actions">

                          <button
                            disabled={
                              sending ||
                              proposal.proposed_by_name ===
                                ''
                            }
                            onClick={
                              () =>
                                decide(
                                  proposal,
                                  'Approved'
                                )
                            }
                          >
                            Approve
                          </button>

                          <button
                            disabled={
                              sending
                            }
                            onClick={
                              () =>
                                decide(
                                  proposal,
                                  'Rejected'
                                )
                            }
                          >
                            Reject
                          </button>

                        </div>
                      )
                      : null
                  }

                </article>

              )
            )
        }

        {
          !proposals.length
            ? (
              <p>
                No change proposals.
              </p>
            )
            : null
        }

        <h3>
          Research history
        </h3>

        {
          jobs
            .slice(
              0,
              5
            )
            .map(
              (
                job
              ) => (

                <article
                  key={
                    job.id
                  }
                >

                  <span>
                    {
                      job.status
                    }
                  </span>

                  <strong>
                    {
                      job.title
                    }
                  </strong>

                  <small>
                    {
                      job.question
                    }
                  </small>

                </article>

              )
            )
        }

      </aside>

    </div>
  )
}