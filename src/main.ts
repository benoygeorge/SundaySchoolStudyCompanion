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

type AppState = {
  gradeIndex: GradeIndexEntry[]
  activeGradeId: string
  activeGrade: GradeData | null
  activeQuery: string
  showAnswers: boolean
}

const state: AppState = {
  gradeIndex: [],
  activeGradeId: '',
  activeGrade: null,
  activeQuery: '',
  showAnswers: false
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <div class="page-shell">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>
    <header class="hero-card">
      <div class="eyebrow">Sunday School Study Companion</div>
      <div class="hero-copy">
        <h1>Grade-aware study bank with built-in references.</h1>
        <p>
          Load a grade JSON file, browse the question bank, and keep grade-specific
          reference links in the same data file for a compact static deployment.
        </p>
      </div>
      <div class="hero-tools">
        <label class="control-block">
          <span>Grade</span>
          <select id="grade-select"></select>
        </label>
        <label class="control-block control-block-wide">
          <span>Search</span>
          <input id="search-input" type="search" placeholder="Search questions, chapters, or answers" />
        </label>
        <label class="toggle-pill">
          <input id="answers-toggle" type="checkbox" />
          <span>Show answers</span>
        </label>
      </div>
    </header>

    <main class="layout-grid">
      <aside class="sidebar-stack">
        <section class="panel panel-accent">
          <div class="panel-heading">
            <h2>Current grade</h2>
            <span id="grade-file-label" class="muted-chip">Loading</span>
          </div>
          <div id="grade-summary" class="grade-summary"></div>
        </section>

        <section class="panel">
          <div class="panel-heading">
            <h2>References</h2>
            <span id="reference-count" class="muted-chip">0 links</span>
          </div>
          <div id="references-list" class="reference-list"></div>
        </section>

        <section class="panel">
          <div class="panel-heading">
            <h2>Chapters</h2>
          </div>
          <div id="chapter-pills" class="pill-cloud"></div>
        </section>
      </aside>

      <section class="content-stack">
        <section class="stats-row">
          <article class="stat-card">
            <span class="stat-label">Questions</span>
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

        <section class="panel featured-panel">
          <div class="panel-heading">
            <h2>Question bank</h2>
            <span id="filtered-count" class="muted-chip">0 visible</span>
          </div>
          <div id="question-grid" class="question-grid"></div>
        </section>
      </section>
    </main>
  </div>
`

const gradeSelect = document.querySelector<HTMLSelectElement>('#grade-select')!
const searchInput = document.querySelector<HTMLInputElement>('#search-input')!
const answersToggle = document.querySelector<HTMLInputElement>('#answers-toggle')!
const gradeFileLabel = document.querySelector<HTMLSpanElement>('#grade-file-label')!
const gradeSummary = document.querySelector<HTMLDivElement>('#grade-summary')!
const referencesList = document.querySelector<HTMLDivElement>('#references-list')!
const referenceCount = document.querySelector<HTMLSpanElement>('#reference-count')!
const chapterPills = document.querySelector<HTMLDivElement>('#chapter-pills')!
const questionCount = document.querySelector<HTMLSpanElement>('#question-count')!
const chapterCount = document.querySelector<HTMLSpanElement>('#chapter-count')!
const answerCount = document.querySelector<HTMLSpanElement>('#answer-count')!
const filteredCount = document.querySelector<HTMLSpanElement>('#filtered-count')!
const questionGrid = document.querySelector<HTMLDivElement>('#question-grid')!

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

function activeGradeLabel(): string {
  return state.gradeIndex.find((entry) => entry.id === state.activeGradeId)?.label ?? state.activeGradeId
}

function questionMatchesSearch(question: StudyQuestion, query: string): boolean {
  if (!query) {
    return true
  }

  const haystack = [
    question.chapter,
    question.section ?? '',
    question.question,
    question.answer ?? '',
    question.explanation ?? '',
    question.source_excerpt ?? ''
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query.toLowerCase())
}

function getFilteredQuestions(): StudyQuestion[] {
  const grade = state.activeGrade
  if (!grade) {
    return []
  }

  return grade.questions.filter((question) => questionMatchesSearch(question, state.activeQuery))
}

function renderGradeSummary(): void {
  if (!state.activeGrade) {
    gradeSummary.innerHTML = '<p class="muted-copy">No grade loaded.</p>'
    gradeFileLabel.textContent = 'Unavailable'
    return
  }

  const grade = state.activeGrade
  const chapters = new Map<string, string>()
  grade.questions.forEach((question) => {
    if (!chapters.has(question.chapter)) {
      chapters.set(question.chapter, question.chapter)
    }
  })

  gradeSummary.innerHTML = `
    <div class="summary-block">
      <div>
        <span class="summary-label">Grade</span>
        <strong>${escapeHtml(grade.grade)}</strong>
      </div>
      <div>
        <span class="summary-label">Title</span>
        <strong>${escapeHtml(grade.title ?? activeGradeLabel())}</strong>
      </div>
      <div>
        <span class="summary-label">Description</span>
        <p>${escapeHtml(grade.description ?? 'Study data and references live in the same JSON file for this grade.')}</p>
      </div>
    </div>
  `

  gradeFileLabel.textContent = `${state.activeGradeId}.json`
  questionCount.textContent = `${grade.questions.length}`
  chapterCount.textContent = `${chapters.size}`
  answerCount.textContent = `${grade.questions.filter((question) => Boolean(question.answer)).length}`
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
        </a>
      `
    })
    .join('')
}

function renderChapters(): void {
  const chapters = Array.from(new Set((state.activeGrade?.questions ?? []).map((question) => question.chapter)))
  chapterPills.innerHTML = chapters
    .map((chapter) => `<span class="chapter-pill">${escapeHtml(chapter)}</span>`)
    .join('')
}

function renderQuestions(): void {
  const questions = getFilteredQuestions()
  filteredCount.textContent = `${questions.length} visible`

  if (questions.length === 0) {
    questionGrid.innerHTML = '<p class="muted-copy">No questions matched the current search.</p>'
    return
  }

  questionGrid.innerHTML = questions
    .map((question, index) => {
      const difficulty = formatDifficulty(question.difficulty)
      const shouldShowAnswer = state.showAnswers && Boolean(question.answer)
      const answerBlock = question.answer
        ? `
          <div class="answer-block ${shouldShowAnswer ? 'answer-open' : ''}">
            <span class="answer-label">Answer</span>
            <p>${escapeHtml(question.answer)}</p>
            ${question.explanation ? `<p class="answer-note">${escapeHtml(question.explanation)}</p>` : ''}
          </div>
        `
        : '<p class="muted-copy">No answer text was provided for this item.</p>'

      return `
        <article class="question-card">
          <div class="question-card-top">
            <span class="chip">${escapeHtml(question.chapter)}</span>
            <span class="chip chip-soft">${escapeHtml(formatType(question.type))}</span>
            <span class="chip chip-${escapeHtml(difficulty)}">${escapeHtml(difficulty)}</span>
          </div>
          <h3>${index + 1}. ${escapeHtml(question.question)}</h3>
          <div class="question-meta">
            ${question.section ? `<span>${escapeHtml(question.section)}</span>` : ''}
            ${question.page ? `<span>Page ${escapeHtml(String(question.page))}</span>` : ''}
            ${question.source_excerpt ? `<span>${escapeHtml(question.source_excerpt)}</span>` : ''}
          </div>
          ${answerBlock}
        </article>
      `
    })
    .join('')
}

function renderApp(): void {
  renderGradeSummary()
  renderReferences()
  renderChapters()
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
  renderApp()
}

gradeSelect.addEventListener('change', async () => {
  const nextGrade = state.gradeIndex.find((entry) => entry.id === gradeSelect.value)
  if (!nextGrade) {
    return
  }

  await loadGrade(nextGrade)
})

searchInput.addEventListener('input', () => {
  state.activeQuery = searchInput.value.trim()
  renderQuestions()
})

answersToggle.addEventListener('change', () => {
  state.showAnswers = answersToggle.checked
  renderQuestions()
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