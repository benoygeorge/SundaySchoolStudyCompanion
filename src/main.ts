import './styles.css'

type GradeIndexEntry = {
  id: string
  label: string
  file: string
  description?: string
}

type StudyQuestion = {
  id: string
  chapter: string
  section?: string | null
  page?: number | null
  type: string
  difficulty?: string | null
  question: string
  options?: string[] | null
  answer?: string | null
  explanation?: string | null
  source_excerpt?: string | null
}

type StudyReference = {
  title: string
  href: string
  description?: string
  category?: string
}

type GradeData = {
  grade: string
  title?: string
  description?: string
  chapters?: Array<{
    id: string
    title: string
    group?: string
  }>
  questions: StudyQuestion[]
  references?: StudyReference[]
}

type ChapterChoice = {
  id: string
  title: string
  group: string
}

type SelfGrade = 'acceptable' | 'incorrect'
type QuestionProgress = { revealed: boolean; selfGrade: SelfGrade | null }

type AppState = {
  gradeIndex: GradeIndexEntry[]
  activeGradeId: string
  activeGrade: GradeData | null
  activeQuery: string
  selectedChapters: string[]
  quizSize: number
  activeQuestionIndex: number
  sessionQuestions: StudyQuestion[]
  chapterSelectionInitialized: boolean
  sessionStarted: boolean
  questionProgress: Record<string, QuestionProgress>
}

const state: AppState = {
  gradeIndex: [],
  activeGradeId: '',
  activeGrade: null,
  activeQuery: '',
  selectedChapters: [],
  quizSize: 10,
  activeQuestionIndex: 0,
  sessionQuestions: [],
  chapterSelectionInitialized: false,
  sessionStarted: false,
  questionProgress: {}
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <div class="page-shell">
    <header class="app-header">
      <div class="brand-block">
        <div class="eyebrow">Sunday School Study Companion</div>
        <h1>Study Companion</h1>
      </div>
      <div class="header-tools">
        <label class="control-block hero-grade-picker">
          <span>Select Grade</span>
          <select id="grade-select"></select>
        </label>
      </div>
    </header>

    <main class="layout-grid">
      <section class="content-stack">
        <section class="panel setup-panel">
          <div class="panel-heading setup-heading">
            <div>
              <h2>Study Session</h2>
              <span id="session-hint" class="muted-copy">Choose chapters and a question count.</span>
            </div>
            <div class="panel-heading-actions">
              <span id="available-count-label" class="muted-chip">0 questions available</span>
              <button type="button" id="start-session-top-btn" class="start-session-button start-session-button-compact">Start</button>
            </div>
          </div>

          <div class="setup-grid">
            <div class="setup-card question-count-card">
              <label class="control-block">
                <span>Questions</span>
                <input id="quiz-size" type="number" min="1" value="10" />
              </label>

              <div class="preset-row">
                <button type="button" class="preset-button" data-preset="10">10</button>
                <button type="button" class="preset-button" data-preset="25">25</button>
                <button type="button" class="preset-button" data-preset="50">50</button>
                <button type="button" class="preset-button preset-button-primary" data-preset="all">All</button>
              </div>
            </div>

            <div class="setup-card chapter-picker-card">
              <div class="setup-header">
                <h3>Chapters</h3>
                <div class="setup-actions">
                  <button type="button" class="link-button" id="select-all-chapters">Select All</button>
                  <button type="button" class="link-button link-button-muted" id="clear-all-chapters">Clear</button>
                </div>
              </div>
              <div id="chapters-grid" class="chapters-grid"></div>
            </div>
          </div>

          <div class="setup-footer">
            <button type="button" id="start-session-btn" class="start-session-button">Start Study Session</button>
          </div>
        </section>

        <section class="stats-row">
          <article class="stat-card">
            <span class="stat-label">Bank</span>
            <strong id="question-count">0</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Chapters</span>
            <strong id="chapter-count">0</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Answered</span>
            <strong id="answer-count">0</strong>
          </article>
        </section>

        <section id="session-panel" class="panel featured-panel" hidden>
          <div class="panel-heading">
            <h2>Study Question</h2>
            <div class="panel-heading-actions">
              <button type="button" id="repeat-missed-btn" class="link-button link-button-muted" disabled>Repeat Missed</button>
              <button type="button" id="exit-session-btn" class="link-button link-button-muted" hidden>Exit Session</button>
              <span id="filtered-count" class="muted-chip">0 in session</span>
            </div>
          </div>
          <div id="question-grid" class="question-grid"></div>
        </section>
      </section>

      <aside class="sidebar-stack">
        <section class="panel references-panel">
          <div class="panel-heading">
            <h2>References</h2>
            <span id="reference-count" class="muted-chip">0 links</span>
          </div>
          <div id="references-list" class="reference-list"></div>
        </section>
      </aside>
    </main>
  </div>
`

const gradeSelect = document.querySelector<HTMLSelectElement>('#grade-select')!
const setupPanel = document.querySelector<HTMLElement>('.setup-panel')!
const referencesList = document.querySelector<HTMLDivElement>('#references-list')!
const referenceCount = document.querySelector<HTMLSpanElement>('#reference-count')!
const questionCount = document.querySelector<HTMLSpanElement>('#question-count')!
const chapterCount = document.querySelector<HTMLSpanElement>('#chapter-count')!
const answerCount = document.querySelector<HTMLSpanElement>('#answer-count')!
const filteredCount = document.querySelector<HTMLSpanElement>('#filtered-count')!
const questionGrid = document.querySelector<HTMLDivElement>('#question-grid')!
const sessionPanel = document.querySelector<HTMLElement>('#session-panel')!
const repeatMissedButton = document.querySelector<HTMLButtonElement>('#repeat-missed-btn')!
const exitSessionButton = document.querySelector<HTMLButtonElement>('#exit-session-btn')!
const quizSizeInput = document.querySelector<HTMLInputElement>('#quiz-size')!
const availableCountLabel = document.querySelector<HTMLSpanElement>('#available-count-label')!
const chaptersGrid = document.querySelector<HTMLDivElement>('#chapters-grid')!
const startSessionButton = document.querySelector<HTMLButtonElement>('#start-session-btn')!
const startSessionTopButton = document.querySelector<HTMLButtonElement>('#start-session-top-btn')!
const selectAllChaptersButton = document.querySelector<HTMLButtonElement>('#select-all-chapters')!
const clearAllChaptersButton = document.querySelector<HTMLButtonElement>('#clear-all-chapters')!

const presetButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-preset]'))

const defaultGradeId = 'grade-10'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatType(type: string): string {
  return type.replaceAll('_', ' ')
}

function formatDifficulty(difficulty?: string | null): string {
  if (!difficulty) {
    return 'unknown'
  }

  return difficulty.toLowerCase()
}

function formatSelfGrade(selfGrade: SelfGrade): string {
  return selfGrade === 'acceptable' ? 'Correct' : 'Missed'
}

function getChapterChoices(): ChapterChoice[] {
  const chapters = state.activeGrade?.chapters ?? []

  if (chapters.length > 0) {
    return chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      group: chapter.group ?? 'Study Chapters'
    }))
  }

  const chapterNames = Array.from(new Set((state.activeGrade?.questions ?? []).map((question) => question.chapter)))
  return chapterNames.map((chapter) => ({
    id: chapter,
    title: chapter,
    group: 'Study Chapters'
  }))
}

function getChapterDisplayName(chapterId: string): string {
  return getChapterChoices().find((chapter) => chapter.id === chapterId)?.title ?? chapterId
}

function getSelectedQuestionPool(): StudyQuestion[] {
  const grade = state.activeGrade
  if (!grade) {
    return []
  }

  if (state.selectedChapters.length === 0 && state.chapterSelectionInitialized) {
    return []
  }

  const chapterFilter = state.selectedChapters.length > 0 ? state.selectedChapters : getChapterChoices().map((chapter) => chapter.id)
  return grade.questions.filter((question) => chapterFilter.includes(question.chapter))
}

function questionMatchesSearch(question: StudyQuestion, query: string): boolean {
  if (!query) {
    return true
  }

  const haystack = [
    question.chapter,
    getChapterDisplayName(question.chapter),
    question.section ?? '',
    question.question,
    (question.options ?? []).join(' '),
    question.answer ?? '',
    question.explanation ?? '',
    question.source_excerpt ?? ''
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function syncChapterSelection(chapters: ChapterChoice[]): void {
  if (!state.chapterSelectionInitialized && state.selectedChapters.length === 0) {
    state.selectedChapters = chapters.map((chapter) => chapter.id)
  } else {
    state.selectedChapters = state.selectedChapters.filter((chapterId) => chapters.some((chapter) => chapter.id === chapterId))
  }
}

function renderSetupPanel(): void {
  setupPanel.hidden = state.sessionStarted

  const chapters = getChapterChoices()
  syncChapterSelection(chapters)

  chaptersGrid.innerHTML = ''
  const grouped = new Map<string, ChapterChoice[]>()
  chapters.forEach((chapter) => {
    const list = grouped.get(chapter.group) ?? []
    list.push(chapter)
    grouped.set(chapter.group, list)
  })

  grouped.forEach((list, group) => {
    const groupPanel = document.createElement('section')
    groupPanel.className = 'chapter-group'
    groupPanel.innerHTML = `
      <h4>${escapeHtml(group)}</h4>
      <div class="chapter-choice-list">
        ${list
          .map((chapter) => {
            const checked = state.selectedChapters.includes(chapter.id) ? 'checked' : ''
            return `
              <label class="chapter-choice">
                <input type="checkbox" value="${escapeHtml(chapter.id)}" ${checked} />
                <span class="chapter-choice-text">
                  <strong>${escapeHtml(chapter.id)}</strong>
                  <span>${escapeHtml(chapter.title)}</span>
                </span>
              </label>
            `
          })
          .join('')}
      </div>
    `
    chaptersGrid.appendChild(groupPanel)
  })

  const selectedPool = getSelectedQuestionPool()
  availableCountLabel.textContent = `${state.selectedChapters.length} chapters selected · ${selectedPool.length} questions available`
  startSessionButton.disabled = selectedPool.length === 0
  startSessionTopButton.disabled = selectedPool.length === 0

  const maxAllowed = Math.max(1, selectedPool.length)
  quizSizeInput.max = String(maxAllowed)
  if (state.quizSize > maxAllowed) {
    state.quizSize = maxAllowed
  }
  quizSizeInput.value = String(state.quizSize)

  chaptersGrid.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const ids = Array.from(chaptersGrid.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
        .filter((input) => input.checked)
        .map((input) => input.value)
      state.selectedChapters = ids
      renderSetupPanel()
      if (state.sessionStarted) {
        buildSessionQuestions()
        renderGradeStats()
        renderQuestions()
      }
    })
  })
}

function renderGradeStats(): void {
  if (!state.activeGrade) {
    questionCount.textContent = '0'
    chapterCount.textContent = '0'
    answerCount.textContent = '0'
    return
  }

  const grade = state.activeGrade
  questionCount.textContent = `${grade.questions.length}`
  chapterCount.textContent = `${getChapterChoices().length}`
  answerCount.textContent = `${Object.values(state.questionProgress).filter((entry) => entry.selfGrade !== null).length}`
}

function buildSessionQuestions(): void {
  const pool = getSelectedQuestionPool().filter((question) => questionMatchesSearch(question, state.activeQuery))
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  state.sessionQuestions = shuffled.slice(0, Math.min(state.quizSize, shuffled.length))
  state.activeQuestionIndex = 0
  state.questionProgress = Object.fromEntries(
    state.sessionQuestions.map((question) => [question.id, { revealed: false, selfGrade: null }])
  )
}

function getQuestionProgress(questionId: string): QuestionProgress {
  return state.questionProgress[questionId] ?? { revealed: false, selfGrade: null }
}

function getSessionProgress(): { answered: number; acceptable: number; incorrect: number; total: number; percent: number } {
  const entries = state.sessionQuestions.map((question) => getQuestionProgress(question.id))
  const answered = entries.filter((entry) => entry.selfGrade !== null).length
  const acceptable = entries.filter((entry) => entry.selfGrade === 'acceptable').length
  const incorrect = entries.filter((entry) => entry.selfGrade === 'incorrect').length
  const total = state.sessionQuestions.length
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0

  return { answered, acceptable, incorrect, total, percent }
}

function clampActiveQuestionIndex(): void {
  const maxIndex = Math.max(0, state.sessionQuestions.length - 1)
  state.activeQuestionIndex = Math.max(0, Math.min(maxIndex, state.activeQuestionIndex))
}

function navigateQuestion(direction: 'previous' | 'next'): void {
  const step = direction === 'previous' ? -1 : 1
  state.activeQuestionIndex += step
  clampActiveQuestionIndex()
  renderQuestions()
}

function revealQuestion(questionId: string): void {
  const current = getQuestionProgress(questionId)
  state.questionProgress[questionId] = { ...current, revealed: true }
  renderQuestions()
}

function gradeQuestion(questionId: string, selfGrade: SelfGrade): void {
  const current = getQuestionProgress(questionId)
  state.questionProgress[questionId] = { ...current, revealed: true, selfGrade }
  renderGradeStats()
  renderQuestions()
}

function repeatMissedQuestions(): void {
  const missed = state.sessionQuestions.filter((question) => getQuestionProgress(question.id).selfGrade === 'incorrect')

  if (missed.length === 0) {
    return
  }

  state.sessionQuestions = missed
  state.quizSize = missed.length
  state.activeQuestionIndex = 0
  state.questionProgress = Object.fromEntries(missed.map((question) => [question.id, { revealed: false, selfGrade: null }]))
  quizSizeInput.value = String(missed.length)
  quizSizeInput.max = String(Math.max(1, missed.length))
  renderGradeStats()
  renderQuestions()
}

function startSession(): void {
  state.sessionStarted = true
  buildSessionQuestions()
  renderApp()
  sessionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function endSession(): void {
  state.sessionStarted = false
  state.sessionQuestions = []
  state.activeQuestionIndex = 0
  state.questionProgress = {}
  renderApp()
  setupPanel.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function renderReferences(): void {
  const references = state.activeGrade?.references ?? []
  referenceCount.textContent = `${references.length} link${references.length === 1 ? '' : 's'}`

  if (references.length === 0) {
    referencesList.innerHTML = '<p class="muted-copy">No references defined for this grade yet.</p>'
    return
  }

  referencesList.innerHTML = references
    .map((reference) => {
      const category = reference.category ? `<span class="reference-tag">${escapeHtml(reference.category)}</span>` : ''
      return `
        <a class="reference-card" href="${escapeHtml(reference.href)}" target="_blank" rel="noreferrer">
          <div class="reference-card-top">
            <strong>${escapeHtml(reference.title)}</strong>
            ${category}
          </div>
          <p>${escapeHtml(reference.description ?? 'Open reference')}</p>
          <div class="reference-open">Open link</div>
        </a>
      `
    })
    .join('')
}

function renderQuestions(): void {
  sessionPanel.hidden = !state.sessionStarted
  repeatMissedButton.hidden = !state.sessionStarted
  exitSessionButton.hidden = !state.sessionStarted

  if (!state.sessionStarted) {
    filteredCount.textContent = '0 in session'
    repeatMissedButton.disabled = true
    questionGrid.innerHTML = `
      <div class="empty-state">
        <strong>Ready when you are.</strong>
        <p class="muted-copy">Start a study session to practice one question at a time.</p>
      </div>
    `
    return
  }

  const questions = state.sessionQuestions
  filteredCount.textContent = `${questions.length} in session`

  const missedCount = questions.filter((question) => getQuestionProgress(question.id).selfGrade === 'incorrect').length
  repeatMissedButton.disabled = missedCount === 0

  if (questions.length === 0) {
    questionGrid.innerHTML = `
      <div class="empty-state">
        <strong>No questions available.</strong>
        <p class="muted-copy">Select at least one chapter with available questions.</p>
      </div>
    `
    return
  }

  clampActiveQuestionIndex()

  const index = state.activeQuestionIndex
  const question = questions[index]
  const difficulty = formatDifficulty(question.difficulty)
  const progress = getQuestionProgress(question.id)
  const sessionProgress = getSessionProgress()
  const shouldShowAnswer = progress.revealed && Boolean(question.answer)
  const answerBlock = question.answer
    ? (shouldShowAnswer
        ? `
          <div class="answer-block answer-open">
            <span class="answer-label">Answer</span>
            <p>${escapeHtml(question.answer)}</p>
            ${question.explanation ? `<p class="answer-note">${escapeHtml(question.explanation)}</p>` : ''}
          </div>
        `
        : '')
    : '<p class="muted-copy">No answer text was provided for this item.</p>'

  const statusChip = progress.selfGrade
    ? `<span class="chip ${progress.selfGrade === 'acceptable' ? 'chip-easy' : 'chip-hard'}">${escapeHtml(formatSelfGrade(progress.selfGrade))}</span>`
    : ''

  const revealButton = question.answer && !progress.revealed
    ? `<button type="button" class="card-action-button card-action-button-primary" data-action="reveal" data-question-id="${escapeHtml(question.id)}">Reveal Answer</button>`
    : ''

  const optionBlock = question.options?.length
    ? `
      <ol class="option-list">
        ${question.options.map((option) => `<li>${escapeHtml(option)}</li>`).join('')}
      </ol>
    `
    : ''

  const selfAssessButtons = progress.revealed && question.answer
    ? `
      <div class="self-assess-row">
        <button type="button" class="card-action-button card-action-button-good" data-action="acceptable" data-question-id="${escapeHtml(question.id)}">Correct</button>
        <button type="button" class="card-action-button card-action-button-bad" data-action="incorrect" data-question-id="${escapeHtml(question.id)}">Missed</button>
      </div>
    `
    : ''

  const previousDisabled = index === 0 ? 'disabled' : ''
  const isLastQuestion = index === questions.length - 1
  const nextAction = isLastQuestion ? 'complete' : 'next'
  const nextLabel = isLastQuestion ? 'Complete' : 'Next'

  questionGrid.innerHTML = `
    <div class="session-progress">
      <div class="session-progress-top">
        <strong>Question ${index + 1} of ${questions.length}</strong>
        <span>${sessionProgress.answered}/${sessionProgress.total} answered · ${sessionProgress.acceptable} correct · ${sessionProgress.incorrect} missed</span>
      </div>
      <div class="progress-track" aria-label="Answered progress">
        <span style="width: ${sessionProgress.percent}%"></span>
      </div>
    </div>

    <article class="question-card">
      <div class="question-card-top">
        <span class="chip">${escapeHtml(getChapterDisplayName(question.chapter))}</span>
        <span class="chip chip-soft">${escapeHtml(formatType(question.type))}</span>
        <span class="chip chip-${escapeHtml(difficulty)}">${escapeHtml(difficulty)}</span>
        ${statusChip}
      </div>
      <h3>${escapeHtml(question.question)}</h3>
      <div class="question-meta">
        ${question.section ? `<span>${escapeHtml(question.section)}</span>` : ''}
        ${question.page ? `<span>Page ${escapeHtml(String(question.page))}</span>` : ''}
        ${question.source_excerpt ? `<span>${escapeHtml(question.source_excerpt)}</span>` : ''}
      </div>
      ${optionBlock}
      ${revealButton}
      ${answerBlock}
      ${selfAssessButtons}
    </article>

    <div class="question-nav">
      <button type="button" class="nav-button" data-action="previous" ${previousDisabled}>Previous</button>
      <span class="question-position">${index + 1} / ${questions.length}</span>
      <button type="button" class="nav-button nav-button-primary" data-action="${nextAction}">${nextLabel}</button>
    </div>
  `
}

function renderApp(): void {
  renderGradeStats()
  renderSetupPanel()
  renderReferences()
  renderQuestions()
}

async function loadGradeIndex(): Promise<void> {
  const response = await fetch('/data/grade-index.json')
  if (!response.ok) {
    throw new Error('Unable to load grade index')
  }

  const payload = (await response.json()) as { grades: GradeIndexEntry[] }
  state.gradeIndex = payload.grades

  gradeSelect.innerHTML = state.gradeIndex
    .map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>`)
    .join('')

  const preferredGrade = state.gradeIndex.find((entry) => entry.id === defaultGradeId) ?? state.gradeIndex[0]
  if (!preferredGrade) {
    throw new Error('No grades were found in the index file')
  }

  gradeSelect.value = preferredGrade.id
  state.activeGradeId = preferredGrade.id
  await loadGrade(preferredGrade)
}

async function loadGrade(entry: GradeIndexEntry): Promise<void> {
  const response = await fetch(entry.file)
  if (!response.ok) {
    throw new Error(`Unable to load ${entry.file}`)
  }

  state.activeGrade = (await response.json()) as GradeData
  state.activeGradeId = entry.id
  state.selectedChapters = []
  state.quizSize = 10
  state.activeQuestionIndex = 0
  state.sessionQuestions = []
  state.questionProgress = {}
  state.chapterSelectionInitialized = false
  state.sessionStarted = false
  renderApp()
}

gradeSelect.addEventListener('change', async () => {
  const nextGrade = state.gradeIndex.find((entry) => entry.id === gradeSelect.value)
  if (!nextGrade) {
    return
  }

  await loadGrade(nextGrade)
})

quizSizeInput.addEventListener('input', () => {
  const max = Number(quizSizeInput.max || '1')
  const value = Math.max(1, Math.min(max, Number(quizSizeInput.value) || 1))
  state.quizSize = value
  quizSizeInput.value = String(value)
  if (state.sessionStarted) {
    buildSessionQuestions()
    renderGradeStats()
    renderQuestions()
  }
})

presetButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const max = Number(quizSizeInput.max || '1')
    const preset = button.dataset.preset
    state.quizSize = preset === 'all' ? max : Math.max(1, Math.min(max, Number(preset) || 1))
    quizSizeInput.value = String(state.quizSize)
    if (state.sessionStarted) {
      buildSessionQuestions()
      renderGradeStats()
      renderQuestions()
    }
  })
})

selectAllChaptersButton.addEventListener('click', () => {
  state.selectedChapters = getChapterChoices().map((chapter) => chapter.id)
  state.chapterSelectionInitialized = true
  renderSetupPanel()
  if (state.sessionStarted) {
    buildSessionQuestions()
    renderGradeStats()
    renderQuestions()
  }
})

clearAllChaptersButton.addEventListener('click', () => {
  state.selectedChapters = []
  state.chapterSelectionInitialized = true
  renderSetupPanel()
  if (state.sessionStarted) {
    buildSessionQuestions()
    renderGradeStats()
    renderQuestions()
  }
})

startSessionButton.addEventListener('click', () => {
  startSession()
})

startSessionTopButton.addEventListener('click', () => {
  startSession()
})

repeatMissedButton.addEventListener('click', () => {
  repeatMissedQuestions()
})

exitSessionButton.addEventListener('click', () => {
  endSession()
})

questionGrid.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null
  const action = target?.closest<HTMLButtonElement>('[data-action]')

  if (!action) {
    return
  }

  const verb = action.dataset.action as 'reveal' | 'acceptable' | 'incorrect' | 'previous' | 'next' | 'complete' | undefined
  if (!verb) {
    return
  }

  if (verb === 'previous' || verb === 'next') {
    navigateQuestion(verb)
    return
  }

  if (verb === 'complete') {
    endSession()
    return
  }

  const questionId = action.dataset.questionId
  if (!questionId) {
    return
  }

  if (verb === 'reveal') {
    revealQuestion(questionId)
  } else if (verb === 'acceptable') {
    gradeQuestion(questionId, 'acceptable')
  } else if (verb === 'incorrect') {
    gradeQuestion(questionId, 'incorrect')
  }
})

loadGradeIndex().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  app.innerHTML = `
    <div class="error-state">
      <h1>Unable to start the study companion</h1>
      <p>${escapeHtml(message)}</p>
      <p>Check the grade index JSON and reload the page.</p>
    </div>
  `
})
