import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAdminQuestion, loadAdminCurriculum, loadAdminQuestions, saveAdminCurriculum, updateAdminQuestion } from './api/adminClient'
import { loadCurrentUser, login as loginAccount, logout as logoutAccount } from './api/authClient'
import { loadGrades, loadStudyPayload } from './api/studyClient'
import type {
  AdminCurriculumInput,
  AdminQuestion,
  AdminQuestionInput,
  Chapter,
  CurriculumBook,
  CurriculumSection,
  GradeIndexEntry,
  QuestionCitation,
  StudyPayload,
  StudyQuestion,
  StudyReference
} from '../shared/studyContracts'

type SelfGrade = 'acceptable' | 'incorrect'
type QuestionProgress = { revealed: boolean; selfGrade: SelfGrade | null }
type AdminTab = 'curriculum' | 'questions' | 'references'
type ChapterChoice = Chapter & { group: string }

type QuestionFormState = {
  status: AdminQuestion['status']
  questionType: string
  chapterId: string
  difficulty: string
  question: string
  options: string
  answer: string
  explanation: string
  citations: CitationFormState[]
  warningActive: boolean
  warningLabel: string
  warningReason: string
  reason: string
}

type CitationFormState = {
  sourceType: QuestionCitation['sourceType']
  bookId: string
  chapterId: string
  referenceId: string
  page: string
  pageEnd: string
  excerpt: string
}

const defaultGradeId = 'grade-10'
const citationSourceTypeOptions: QuestionCitation['sourceType'][] = ['book', 'reference', 'teacher_note', 'external', 'other']
const referenceResourceTypeOptions: StudyReference['resourceType'][] = ['website', 'study_guide', 'teacher_notes', 'document', 'video', 'liturgy_text', 'other']
const referenceImportanceOptions: StudyReference['importance'][] = ['required', 'recommended', 'optional']
const referenceScopeOptions: StudyReference['scope'][] = ['grade', 'book', 'section', 'chapter', 'general']
const questionTypeOptions = ['mcq', 'true_false', 'short_answer', 'long_answer']
const difficultyOptions = ['easy', 'medium', 'hard']
const trueFalseOptions = ['True', 'False']

function formatType(type: string): string {
  return type.replaceAll('_', ' ')
}

function formatDifficulty(difficulty?: string | null): string {
  return difficulty ? difficulty.toLowerCase() : 'unknown'
}

function formatSelfGrade(selfGrade: SelfGrade): string {
  return selfGrade === 'acceptable' ? 'Correct' : 'Missed'
}

function getChapterChoices(payload?: StudyPayload): ChapterChoice[] {
  const chapters = payload?.chapters ?? []
  const booksById = new Map((payload?.books ?? []).map((book) => [book.id, book.title]))
  const sectionsById = new Map((payload?.sections ?? []).map((section) => [section.id, section]))

  if (chapters.length > 0) {
    return chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      bookId: chapter.bookId,
      sectionId: chapter.sectionId,
      group: [chapter.bookId ? booksById.get(chapter.bookId) : null, chapter.sectionId ? sectionsById.get(chapter.sectionId)?.title : null]
        .filter(Boolean)
        .join(' / ') || 'Study Chapters'
    }))
  }

  return []
}

function getChapterDisplayName(chapters: ChapterChoice[], chapterId: string): string {
  return chapters.find((chapter) => chapter.id === chapterId)?.title ?? chapterId
}

function getReferenceDisplayName(references: StudyReference[], referenceId: string): string {
  return references.find((reference) => reference.id === referenceId)?.title ?? referenceId
}

function formatCitation(citation: QuestionCitation, chapters: ChapterChoice[], references: StudyReference[]): string {
  const parts = [formatType(citation.sourceType)]

  if (citation.referenceId) {
    parts.push(getReferenceDisplayName(references, citation.referenceId))
  } else if (citation.chapterId) {
    parts.push(getChapterDisplayName(chapters, citation.chapterId))
  } else if (citation.bookId) {
    parts.push(citation.bookId)
  }

  if (citation.page) {
    parts.push(`page ${citation.page}${citation.pageEnd ? `-${citation.pageEnd}` : ''}`)
  }

  return parts.filter(Boolean).join(' · ')
}

function shuffleQuestions(questions: StudyQuestion[], quizSize: number): StudyQuestion[] {
  return [...questions].sort(() => Math.random() - 0.5).slice(0, Math.min(quizSize, questions.length))
}

function buildProgress(questions: StudyQuestion[]): Record<string, QuestionProgress> {
  return Object.fromEntries(questions.map((question) => [question.id, { revealed: false, selfGrade: null }]))
}

function textOrUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function splitOptions(value: string): string[] | null {
  const options = value
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter(Boolean)

  return options.length > 0 ? options : null
}

function optionLines(value: string): string[] {
  return splitOptions(value) ?? []
}

function editableOptionLines(value: string): string[] {
  return value ? value.split(/\r?\n/) : []
}

function joinOptions(options?: string[] | null): string {
  return options?.join('\n') ?? ''
}

function isSingleChoiceType(questionType: string): boolean {
  return questionType === 'mcq' || questionType === 'true_false'
}

function normalizeTrueFalseAnswer(answer?: string | null): string {
  const normalized = answer?.trim().toLowerCase()

  if (normalized === 'true') {
    return 'True'
  }

  if (normalized === 'false') {
    return 'False'
  }

  return ''
}

function getQuestionOptions(form: QuestionFormState): string[] {
  return form.questionType === 'true_false' ? trueFalseOptions : optionLines(form.options)
}

function hasSingleChoiceAnswer(form: QuestionFormState): boolean {
  if (!isSingleChoiceType(form.questionType)) {
    return true
  }

  const options = getQuestionOptions(form)
  const answer = form.questionType === 'true_false' ? normalizeTrueFalseAnswer(form.answer) : form.answer.trim()
  return Boolean(answer && options.includes(answer))
}

function citationToForm(citation: QuestionCitation): CitationFormState {
  return {
    sourceType: citation.sourceType,
    bookId: citation.bookId ?? '',
    chapterId: citation.chapterId ?? '',
    referenceId: citation.referenceId ?? '',
    page: citation.page === undefined ? '' : String(citation.page),
    pageEnd: citation.pageEnd === undefined ? '' : String(citation.pageEnd),
    excerpt: citation.excerpt ?? ''
  }
}

function formToCitation(citation: CitationFormState): QuestionCitation | null {
  const bookId = citation.bookId.trim()
  const chapterId = citation.chapterId.trim()
  const referenceId = citation.referenceId.trim()
  const page = citation.page.trim()
  const pageEnd = citation.pageEnd.trim()
  const excerpt = citation.excerpt.trim()

  if (!bookId && !chapterId && !referenceId && !page && !pageEnd && !excerpt) {
    return null
  }

  return {
    sourceType: citation.sourceType,
    bookId: textOrUndefined(bookId),
    chapterId: textOrUndefined(chapterId),
    referenceId: textOrUndefined(referenceId),
    page: textOrUndefined(page),
    pageEnd: textOrUndefined(pageEnd),
    excerpt: textOrNull(excerpt),
    status: 'approved'
  }
}

function sortAdminQuestions(questions: AdminQuestion[]): AdminQuestion[] {
  return [...questions].sort((left, right) => left.chapterId.localeCompare(right.chapterId, undefined, { numeric: true }) || left.id.localeCompare(right.id))
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction

  if (nextIndex < 0 || nextIndex >= items.length) {
    return items
  }

  const nextItems = [...items]
  const [item] = nextItems.splice(index, 1)

  if (item === undefined) {
    return items
  }

  nextItems.splice(nextIndex, 0, item)
  return nextItems
}

function moveFilteredItem<T>(items: T[], visibleIndexes: number[], visibleIndex: number, direction: -1 | 1): T[] {
  const fromIndex = visibleIndexes[visibleIndex]
  const toIndex = visibleIndexes[visibleIndex + direction]

  if (fromIndex === undefined || toIndex === undefined) {
    return items
  }

  const nextItems = [...items]
  const fromItem = nextItems[fromIndex]
  const toItem = nextItems[toIndex]

  if (fromItem === undefined || toItem === undefined) {
    return items
  }

  nextItems[fromIndex] = toItem
  nextItems[toIndex] = fromItem
  return nextItems
}

function normalizeChapters(chapters: Chapter[]): Chapter[] {
  return chapters.map((chapter) => ({
    id: chapter.id.trim(),
    title: chapter.title.trim(),
    bookId: chapter.bookId.trim(),
    sectionId: textOrUndefined(chapter.sectionId ?? '')
  }))
}

function normalizeBooks(books: CurriculumBook[]): CurriculumBook[] {
  return books.map((book) => ({
    id: book.id.trim(),
    role: book.role,
    title: book.title.trim(),
    edition: textOrUndefined(book.edition ?? ''),
    issuedAt: textOrUndefined(book.issuedAt ?? '')
  }))
}

function buildBookId(title: string, existingBooks: CurriculumBook[]): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `book-${existingBooks.length + 1}`
  let candidate = base
  let suffix = 2

  while (existingBooks.some((book) => book.id === candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

function normalizeSections(sections: CurriculumSection[]): CurriculumSection[] {
  return sections.map((section) => ({
    id: section.id.trim(),
    bookId: section.bookId.trim(),
    title: section.title.trim()
  }))
}

function buildSectionId(title: string, bookId: string, existingSections: CurriculumSection[]): string {
  const baseTitle =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `section-${existingSections.length + 1}`
  const base = `${bookId}-${baseTitle}`.replace(/^-+|-+$/g, '')
  let candidate = base
  let suffix = 2

  while (existingSections.some((section) => section.id === candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

function buildReferenceId(title: string, existingReferences: StudyReference[]): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `reference-${existingReferences.length + 1}`
  let candidate = base
  let suffix = 2

  while (existingReferences.some((reference) => reference.id === candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

function validateBooks(books: CurriculumBook[]): void {
  const invalidBook = books.find((book) => !book.id.trim() || !book.title.trim())

  if (invalidBook) {
    throw new Error('Every book needs a name')
  }

  const duplicateBook = books.find((book, index) => books.findIndex((entry) => entry.id.trim() === book.id.trim()) !== index)

  if (duplicateBook) {
    throw new Error(`Book ${duplicateBook.title || duplicateBook.id} is duplicated`)
  }
}

function validateSections(books: CurriculumBook[], sections: CurriculumSection[]): void {
  const bookIds = new Set(books.map((book) => book.id.trim()))
  const invalidSection = sections.find((section) => !section.id.trim() || !section.title.trim() || !section.bookId.trim())

  if (invalidSection) {
    throw new Error('Every section needs a name and book')
  }

  const duplicateSection = sections.find((section, index) => sections.findIndex((entry) => entry.id.trim() === section.id.trim()) !== index)

  if (duplicateSection) {
    throw new Error(`Section ${duplicateSection.title || duplicateSection.id} is duplicated`)
  }

  const orphanSection = sections.find((section) => !bookIds.has(section.bookId.trim()))

  if (orphanSection) {
    throw new Error(`Section ${orphanSection.title} is assigned to a missing book`)
  }
}

function updateChapterSection(chapter: Chapter, sectionId: string): Chapter {
  return {
    ...chapter,
    sectionId: textOrUndefined(sectionId)
  }
}

function normalizeReferences(references: StudyReference[]): StudyReference[] {
  return references.map((reference) => ({
    id: reference.id.trim(),
    title: reference.title.trim(),
    href: textOrUndefined(reference.href ?? ''),
    description: textOrUndefined(reference.description ?? ''),
    resourceType: reference.resourceType,
    importance: reference.importance,
    scope: reference.scope,
    bookId: textOrUndefined(reference.bookId ?? ''),
    sectionId: textOrUndefined(reference.sectionId ?? ''),
    chapterId: textOrUndefined(reference.chapterId ?? '')
  }))
}

function validateCurriculumRows(books: CurriculumBook[], sections: CurriculumSection[], chapters: Chapter[], references: StudyReference[]): void {
  validateBooks(books)
  validateSections(books, sections)

  const bookIds = new Set(books.map((book) => book.id.trim()))
  const sectionsById = new Map(sections.map((section) => [section.id.trim(), section]))

  const invalidChapter = chapters.find((chapter) => !chapter.id.trim() || !chapter.title.trim())

  if (invalidChapter) {
    throw new Error('Every chapter needs an ID and title')
  }

  const duplicateChapter = chapters.find((chapter, index) => chapters.findIndex((entry) => entry.id.trim() === chapter.id.trim()) !== index)

  if (duplicateChapter) {
    throw new Error(`Chapter ID ${duplicateChapter.id} is duplicated`)
  }

  const orphanChapter = chapters.find((chapter) => !chapter.bookId?.trim() || !bookIds.has(chapter.bookId.trim()))

  if (orphanChapter) {
    throw new Error(`Chapter ${orphanChapter.id || orphanChapter.title} needs a valid book`)
  }

  const invalidChapterSection = chapters.find((chapter) => {
    if (!chapter.sectionId) {
      return false
    }

    const section = sectionsById.get(chapter.sectionId.trim())
    return !section || section.bookId !== chapter.bookId
  })

  if (invalidChapterSection) {
    throw new Error(`Chapter ${invalidChapterSection.id || invalidChapterSection.title} has a section that does not belong to its book`)
  }

  const invalidReference = references.find((reference) => !reference.id.trim() || !reference.title.trim())

  if (invalidReference) {
    throw new Error('Every reference needs an ID and title')
  }

  const duplicateReference = references.find((reference, index) => references.findIndex((entry) => entry.id.trim() === reference.id.trim()) !== index)

  if (duplicateReference) {
    throw new Error(`Reference ${duplicateReference.title || duplicateReference.id} is duplicated`)
  }

  const chaptersById = new Map(chapters.map((chapter) => [chapter.id.trim(), chapter]))
  const invalidReferenceTarget = references.find((reference) => {
    if (reference.scope === 'book') {
      return !reference.bookId || !bookIds.has(reference.bookId)
    }

    if (reference.scope === 'section') {
      return !reference.sectionId || !sectionsById.has(reference.sectionId)
    }

    if (reference.scope === 'chapter') {
      return !reference.chapterId || !chaptersById.has(reference.chapterId)
    }

    return false
  })

  if (invalidReferenceTarget) {
    throw new Error(`Reference ${invalidReferenceTarget.title || invalidReferenceTarget.id} needs a valid ${invalidReferenceTarget.scope} target`)
  }
}

function findRenamedRows<T extends { id: string; title: string }>(before: T[], after: T[], label: string): string[] {
  const beforeById = new Map(before.map((entry) => [entry.id, entry.title]))

  return after
    .map((entry) => {
      const beforeTitle = beforeById.get(entry.id)
      return beforeTitle !== undefined && beforeTitle !== entry.title ? `${label}: "${beforeTitle}" -> "${entry.title}"` : null
    })
    .filter((message): message is string => Boolean(message))
}

function findChapterIdChanges(before: Chapter[], after: Chapter[]): string[] {
  return after
    .map((chapter, index) => {
      const previousChapter = before[index]
      return previousChapter && previousChapter.id !== chapter.id ? `Chapter ID changed: "${previousChapter.id}" -> "${chapter.id}" (${chapter.title || previousChapter.title})` : null
    })
    .filter((message): message is string => Boolean(message))
}

function emptyQuestionForm(defaultChapter: string): QuestionFormState {
  return {
    status: 'unrated',
    questionType: 'short_answer',
    chapterId: defaultChapter,
    difficulty: '',
    question: '',
    options: '',
    answer: '',
    explanation: '',
    citations: [],
    warningActive: false,
    warningLabel: '',
    warningReason: '',
    reason: ''
  }
}

function questionToForm(question: AdminQuestion): QuestionFormState {
  const isTrueFalseQuestion = question.questionType === 'true_false'

  return {
    status: question.status,
    questionType: question.questionType,
    chapterId: question.chapterId,
    difficulty: question.difficulty ?? '',
    question: question.question,
    options: isTrueFalseQuestion ? joinOptions(trueFalseOptions) : joinOptions(question.options),
    answer: isTrueFalseQuestion ? normalizeTrueFalseAnswer(question.answer) : (question.answer ?? ''),
    explanation: question.explanation ?? '',
    citations: question.citations?.map(citationToForm) ?? [],
    warningActive: question.warning?.active ?? false,
    warningLabel: question.warning?.label ?? '',
    warningReason: question.warning?.reason ?? '',
    reason: ''
  }
}

function formToQuestionInput(form: QuestionFormState): AdminQuestionInput {
  const citations = form.citations.map(formToCitation).filter((citation): citation is QuestionCitation => Boolean(citation))
  const isSingleChoice = isSingleChoiceType(form.questionType)
  const options = isSingleChoice ? getQuestionOptions(form) : splitOptions(form.options)
  const answer = form.questionType === 'true_false' ? normalizeTrueFalseAnswer(form.answer) : form.answer.trim()

  if (form.questionType === 'mcq' && (options?.length ?? 0) < 2) {
    throw new Error('MCQ questions need at least two options')
  }

  if (isSingleChoice && (!answer || !options?.includes(answer))) {
    throw new Error('Select the correct option before saving this question')
  }

  return {
    reason: form.reason,
    status: form.status,
    questionType: form.questionType,
    chapterId: form.chapterId,
    difficulty: textOrNull(form.difficulty),
    question: form.question,
    options,
    answer: isSingleChoice ? answer : textOrNull(form.answer),
    explanation: textOrNull(form.explanation),
    citations,
    warning: {
      active: form.warningActive,
      label: textOrNull(form.warningLabel),
      reason: textOrNull(form.warningReason)
    }
  }
}

function PageStatus({ title, message }: { title: string; message: string }) {
  return (
    <div className="error-state">
      <h1>{title}</h1>
      <p>{message}</p>
    </div>
  )
}

function StudyPage() {
  const authQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: loadCurrentUser,
    retry: false
  })

  const gradesQuery = useQuery({
    queryKey: ['grades'],
    queryFn: loadGrades
  })

  const grades = gradesQuery.data ?? []
  const [activeGradeId, setActiveGradeId] = useState('')

  useEffect(() => {
    if (activeGradeId || grades.length === 0) {
      return
    }

    setActiveGradeId((grades.find((grade) => grade.id === defaultGradeId) ?? grades[0]).id)
  }, [activeGradeId, grades])

  const activeGrade = useMemo<GradeIndexEntry | undefined>(
    () => grades.find((grade) => grade.id === activeGradeId),
    [activeGradeId, grades]
  )

  const payloadQuery = useQuery({
    queryKey: ['study-payload', activeGrade?.id],
    queryFn: () => loadStudyPayload(activeGrade as GradeIndexEntry),
    enabled: Boolean(activeGrade)
  })

  const payload = payloadQuery.data
  const chapters = useMemo(() => getChapterChoices(payload), [payload])
  const [selectedChapters, setSelectedChapters] = useState<string[]>([])
  const [quizSize, setQuizSize] = useState(10)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [sessionQuestions, setSessionQuestions] = useState<StudyQuestion[]>([])
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const [questionProgress, setQuestionProgress] = useState<Record<string, QuestionProgress>>({})

  useEffect(() => {
    setSelectedChapters(chapters.map((chapter) => chapter.id))
    setQuizSize(10)
    setSessionStarted(false)
    setSessionQuestions([])
    setActiveQuestionIndex(0)
    setQuestionProgress({})
  }, [activeGradeId, chapters])

  const selectedPool = useMemo(() => {
    if (!payload || selectedChapters.length === 0) {
      return []
    }

    return payload.questions.filter((question) => selectedChapters.includes(question.chapterId))
  }, [payload, selectedChapters])

  useEffect(() => {
    setQuizSize((current) => Math.min(Math.max(1, current), Math.max(1, selectedPool.length)))
  }, [selectedPool.length])

  function startSession() {
    const questions = shuffleQuestions(selectedPool, quizSize)
    setSessionQuestions(questions)
    setQuestionProgress(buildProgress(questions))
    setActiveQuestionIndex(0)
    setSessionStarted(true)
  }

  function endSession() {
    setSessionStarted(false)
    setSessionQuestions([])
    setQuestionProgress({})
    setActiveQuestionIndex(0)
  }

  function rebuildActiveSession(nextQuizSize = quizSize) {
    if (!sessionStarted) {
      return
    }

    const questions = shuffleQuestions(selectedPool, nextQuizSize)
    setSessionQuestions(questions)
    setQuestionProgress(buildProgress(questions))
    setActiveQuestionIndex(0)
  }

  function updateQuizSize(value: number) {
    const nextValue = Math.max(1, Math.min(Math.max(1, selectedPool.length), value))
    setQuizSize(nextValue)
    rebuildActiveSession(nextValue)
  }

  function updateSelectedChapters(nextChapters: string[]) {
    setSelectedChapters(nextChapters)
  }

  function revealQuestion(questionId: string) {
    setQuestionProgress((current) => ({
      ...current,
      [questionId]: { ...(current[questionId] ?? { revealed: false, selfGrade: null }), revealed: true }
    }))
  }

  function gradeQuestion(questionId: string, selfGrade: SelfGrade) {
    setQuestionProgress((current) => ({
      ...current,
      [questionId]: { ...(current[questionId] ?? { revealed: false, selfGrade: null }), revealed: true, selfGrade }
    }))
  }

  function repeatMissedQuestions() {
    const missed = sessionQuestions.filter((question) => questionProgress[question.id]?.selfGrade === 'incorrect')

    if (missed.length === 0) {
      return
    }

    setQuizSize(missed.length)
    setSessionQuestions(missed)
    setQuestionProgress(buildProgress(missed))
    setActiveQuestionIndex(0)
  }

  const answeredCount = Object.values(questionProgress).filter((entry) => entry.selfGrade !== null).length

  if (gradesQuery.isLoading || (activeGrade && payloadQuery.isLoading)) {
    return <PageStatus title="Loading study companion" message="Preparing the grade list and study payload." />
  }

  if (gradesQuery.isError || payloadQuery.isError) {
    return <PageStatus title="Unable to start the study companion" message="Check the Study Companion API or static fallback JSON and reload the page." />
  }

  if (!payload) {
    return <PageStatus title="No study content" message="No grades were found in the grade index." />
  }

  return (
    <div className="page-shell">
      <header className="app-header">
        <div className="brand-block">
          <div className="eyebrow">Sunday School Study Companion</div>
          <h1>Study Companion</h1>
        </div>
        <div className="header-tools">
          <AccountPanel />
          <label className="control-block hero-grade-picker">
            <span>Select Grade</span>
            <select value={activeGradeId} onChange={(event) => setActiveGradeId(event.target.value)}>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {authQuery.data?.role === 'Admin' && activeGrade ? <AdminWorkspace grade={activeGrade} payload={payload} /> : null}

      <main className="layout-grid">
        <section className="content-stack">
          {!sessionStarted ? (
            <SetupPanel
              chapters={chapters}
              selectedChapters={selectedChapters}
              quizSize={quizSize}
              selectedPoolCount={selectedPool.length}
              onQuizSizeChange={updateQuizSize}
              onSelectedChaptersChange={updateSelectedChapters}
              onStartSession={startSession}
            />
          ) : null}

          <section className="stats-row">
            <article className="stat-card">
              <span className="stat-label">Bank</span>
              <strong>{payload.questions.length}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Chapters</span>
              <strong>{chapters.length}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Answered</span>
              <strong>{answeredCount}</strong>
            </article>
          </section>

          <SessionPanel
            chapters={chapters}
            references={payload.references ?? []}
            sessionStarted={sessionStarted}
            questions={sessionQuestions}
            activeQuestionIndex={activeQuestionIndex}
            questionProgress={questionProgress}
            onReveal={revealQuestion}
            onGrade={gradeQuestion}
            onRepeatMissed={repeatMissedQuestions}
            onExit={endSession}
            onNavigate={setActiveQuestionIndex}
          />
        </section>

        <aside className="sidebar-stack">
          <ReferencesPanel references={payload.references ?? []} />
        </aside>
      </main>
    </div>
  )
}

function AccountPanel() {
  const queryClient = useQueryClient()
  const [loginOpen, setLoginOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')

  const authQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: loadCurrentUser,
    retry: false
  })

  const loginMutation = useMutation({
    mutationFn: loginAccount,
    onSuccess: (user) => {
      queryClient.setQueryData(['auth', 'me'], user)
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setPassword('')
      setLoginOpen(false)
    }
  })

  const logoutMutation = useMutation({
    mutationFn: logoutAccount,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
      queryClient.removeQueries({ queryKey: ['admin'] })
    }
  })

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    loginMutation.mutate({ user_id: userId, password })
  }

  if (authQuery.data) {
    return (
      <div className="account-panel account-panel-authenticated">
        <div>
          <span className="account-label">{authQuery.data.role}</span>
          <strong>{authQuery.data.id}</strong>
          <span className="account-source">{authQuery.data.sourceRole}</span>
        </div>
        <button type="button" className="link-button link-button-muted" disabled={logoutMutation.isPending} onClick={() => logoutMutation.mutate()}>
          Logout
        </button>
      </div>
    )
  }

  return (
    <div className="account-panel">
      {!loginOpen ? (
        <>
          <span className="account-label">{authQuery.isError ? 'Account API unavailable' : 'Anonymous'}</span>
          <button type="button" className="link-button" disabled={authQuery.isError} onClick={() => setLoginOpen(true)}>
            Login
          </button>
        </>
      ) : (
        <form className="login-form" onSubmit={submitLogin}>
          <label className="control-block">
            <span>User ID</span>
            <input value={userId} onChange={(event) => setUserId(event.target.value)} autoComplete="username" />
          </label>
          <label className="control-block">
            <span>Password</span>
            <input value={password} type="password" onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <div className="login-actions">
            <button type="submit" className="start-session-button start-session-button-compact" disabled={loginMutation.isPending || !userId || !password}>
              Login
            </button>
            <button type="button" className="link-button link-button-muted" onClick={() => setLoginOpen(false)}>
              Cancel
            </button>
          </div>
          {loginMutation.isError ? <p className="form-error">{loginMutation.error.message}</p> : null}
        </form>
      )}
    </div>
  )
}

function AdminWorkspace({ grade, payload }: { grade: GradeIndexEntry; payload: StudyPayload }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('curriculum')
  const chapters = useMemo(() => getChapterChoices(payload), [payload])

  return (
    <section className="panel admin-workspace" aria-label="Admin management">
      <div className="panel-heading admin-heading">
        <div>
          <h2>Admin Management</h2>
          <span className="muted-copy">{grade.label}</span>
        </div>
        <label className="control-block admin-menu-control">
          <span>Admin Menu</span>
          <select value={activeTab} onChange={(event) => setActiveTab(event.target.value as AdminTab)}>
            <option value="curriculum">Curriculum</option>
            <option value="questions">Questions</option>
            <option value="references">References</option>
          </select>
        </label>
      </div>

      {activeTab === 'curriculum' ? <AdminCurriculumPanel grade={grade} payload={payload} /> : null}
      {activeTab === 'questions' ? <AdminQuestionPanel grade={grade} books={payload.books ?? []} chapters={chapters} references={payload.references ?? []} /> : null}
      {activeTab === 'references' ? <AdminReferencesPanel grade={grade} payload={payload} /> : null}
    </section>
  )
}

function AdminCurriculumPanel({ grade, payload }: { grade: GradeIndexEntry; payload: StudyPayload }) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState(grade.label)
  const [title, setTitle] = useState(payload.title ?? '')
  const [description, setDescription] = useState(payload.description ?? '')
  const [books, setBooks] = useState<CurriculumBook[]>(payload.books ?? [])
  const [sections, setSections] = useState<CurriculumSection[]>(payload.sections ?? [])
  const [chapters, setChapters] = useState<Chapter[]>(payload.chapters ?? [])
  const [references, setReferences] = useState<StudyReference[]>(payload.references ?? [])
  const [selectedBookId, setSelectedBookId] = useState('')
  const [managingBookId, setManagingBookId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const curriculumQuery = useQuery({
    queryKey: ['admin', 'curriculum', grade.id],
    queryFn: () => loadAdminCurriculum(grade.id),
    retry: false
  })

  useEffect(() => {
    const curriculum = curriculumQuery.data

    setLabel(curriculum?.label ?? grade.label)
    setTitle(curriculum?.title ?? payload.title ?? '')
    setDescription(curriculum?.description ?? payload.description ?? '')
    setBooks(curriculum?.books ?? payload.books ?? [])
    setSections(curriculum?.sections ?? payload.sections ?? [])
    setChapters(curriculum?.chapters ?? payload.chapters ?? [])
    setReferences(curriculum?.referenceLinks ?? payload.references ?? [])
    setSelectedBookId('')
    setManagingBookId(null)
    setReason('')
    setFormError(null)
  }, [curriculumQuery.data, grade.id, grade.label, payload.books, payload.chapters, payload.description, payload.references, payload.sections, payload.title])

  useEffect(() => {
    if (!managingBookId) {
      setSelectedBookId('')
      return
    }

    if (!books.some((book) => book.id === managingBookId)) {
      setSelectedBookId('')
      setManagingBookId(null)
      return
    }

    setSelectedBookId(managingBookId)
  }, [books, managingBookId])

  const saveMutation = useMutation({
    mutationFn: (input: AdminCurriculumInput) => saveAdminCurriculum(grade.id, input),
    onSuccess: (curriculum) => {
      queryClient.setQueryData(['admin', 'curriculum', grade.id], curriculum)
      queryClient.invalidateQueries({ queryKey: ['grades'] })
      queryClient.invalidateQueries({ queryKey: ['study-payload', grade.id] })
      setManagingBookId(null)
      setSelectedBookId('')
      setReason('')
      setFormError(null)
    }
  })

  const selectedBook = books.find((book) => book.id === selectedBookId)
  const selectedSectionRows = sections.map((section, index) => ({ section, index })).filter(({ section }) => section.bookId === selectedBookId)
  const selectedChapterRows = chapters.map((chapter, index) => ({ chapter, index })).filter(({ chapter }) => chapter.bookId === selectedBookId)
  const selectedSectionIndexes = selectedSectionRows.map(({ index }) => index)
  const selectedChapterIndexes = selectedChapterRows.map(({ index }) => index)

  function confirmCurriculumRenames(): boolean {
    const baselineBooks = curriculumQuery.data?.books ?? payload.books ?? []
    const baselineSections = curriculumQuery.data?.sections ?? payload.sections ?? []
    const baselineChapters = curriculumQuery.data?.chapters ?? payload.chapters ?? []
    const warnings = [
      ...findRenamedRows(baselineBooks, books, 'Book renamed'),
      ...findRenamedRows(baselineSections, sections, 'Section renamed'),
      ...findRenamedRows(baselineChapters, chapters, 'Chapter renamed'),
      ...findRenamedRows(curriculumQuery.data?.referenceLinks ?? payload.references ?? [], references, 'Reference renamed'),
      ...findChapterIdChanges(baselineChapters, chapters)
    ]

    if (warnings.length === 0) {
      return true
    }

    return window.confirm(`Confirm curriculum rename changes before saving.\\n\\n${warnings.join('\\n')}`)
  }

  function submitCurriculum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      validateCurriculumRows(books, sections, chapters, references)

      if (!confirmCurriculumRenames()) {
        return
      }

      const input: AdminCurriculumInput = {
        label,
        title: textOrUndefined(title),
        description: textOrUndefined(description),
        reason,
        books: normalizeBooks(books),
        sections: normalizeSections(sections),
        chapters: normalizeChapters(chapters),
        referenceLinks: normalizeReferences(references)
      }
      setFormError(null)
      saveMutation.mutate(input)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save curriculum')
    }
  }

  function updateBook(index: number, field: keyof CurriculumBook, value: string) {
    setBooks((current) =>
      current.map((book, bookIndex) => {
        if (bookIndex !== index) {
          return book
        }

        const nextBook = {
          ...book,
          [field]: value
        }

        if (field === 'id') {
          const nextBookId = value.trim()
          setSections((currentSections) => currentSections.map((section) => (section.bookId === book.id ? { ...section, bookId: nextBookId } : section)))
          setChapters((currentChapters) => currentChapters.map((chapter) => (chapter.bookId === book.id ? { ...chapter, bookId: nextBookId } : chapter)))
          setSelectedBookId((currentSelectedBookId) => (currentSelectedBookId === book.id ? nextBookId : currentSelectedBookId))
          setManagingBookId((currentManagingBookId) => (currentManagingBookId === book.id ? nextBookId : currentManagingBookId))
        }

        return nextBook
      })
    )
  }

  function addBook(role: CurriculumBook['role']) {
    setBooks((current) => {
      const nextBook = {
        id: buildBookId(role === 'primary' ? 'primary-textbook' : 'supplemental-book', current),
        role,
        title: role === 'primary' ? 'Primary Textbook' : 'Supplementary Book',
        edition: '',
        issuedAt: ''
      }
      setManagingBookId(nextBook.id)
      setSelectedBookId(nextBook.id)
      return [...current, nextBook]
    })
  }

  function removeBook(index: number) {
    setBooks((current) => {
      const removedBookId = current[index]?.id
      const removedBook = current[index]

      if (removedBookId) {
        const sectionCount = sections.filter((section) => section.bookId === removedBookId).length
        const chapterCount = chapters.filter((chapter) => chapter.bookId === removedBookId).length
        const confirmed = window.confirm(
          `Remove "${removedBook?.title ?? removedBookId}"? This will also remove ${sectionCount} section${sectionCount === 1 ? '' : 's'} and ${chapterCount} chapter${chapterCount === 1 ? '' : 's'} from the curriculum editor.`
        )

        if (!confirmed) {
          return current
        }

        setSections((currentSections) => currentSections.filter((section) => section.bookId !== removedBookId))
        setChapters((currentChapters) => currentChapters.filter((chapter) => chapter.bookId !== removedBookId))
        setManagingBookId((currentManagingBookId) => (currentManagingBookId === removedBookId ? null : currentManagingBookId))
        setSelectedBookId((currentSelectedBookId) => (currentSelectedBookId === removedBookId ? '' : currentSelectedBookId))
      }

      return current.filter((_, bookIndex) => bookIndex !== index)
    })
  }

  function updateSection(index: number, field: keyof CurriculumSection, value: string) {
    setSections((current) => current.map((section, sectionIndex) => (sectionIndex === index ? { ...section, [field]: value } : section)))
  }

  function addSection() {
    if (!selectedBookId) {
      return
    }

    setSections((current) => [
      ...current,
      {
        id: buildSectionId('new-section', selectedBookId, current),
        bookId: selectedBookId,
        title: 'New Section'
      }
    ])
  }

  function removeSection(index: number) {
    setSections((current) => {
      const removedSectionId = current[index]?.id
      const removedSection = current[index]

      if (removedSectionId) {
        const chapterCount = chapters.filter((chapter) => chapter.sectionId === removedSectionId).length
        const confirmed = window.confirm(
          `Remove section "${removedSection?.title ?? removedSectionId}"? ${chapterCount} chapter${chapterCount === 1 ? '' : 's'} will stay under the selected book with no section.`
        )

        if (!confirmed) {
          return current
        }

        setChapters((currentChapters) => currentChapters.map((chapter) => (chapter.sectionId === removedSectionId ? { ...chapter, sectionId: undefined } : chapter)))
      }

      return current.filter((_, sectionIndex) => sectionIndex !== index)
    })
  }

  function updateChapter(index: number, field: keyof Chapter, value: string) {
    setChapters((current) => current.map((chapter, chapterIndex) => (chapterIndex === index ? { ...chapter, [field]: value } : chapter)))
  }

  function updateChapterSectionField(index: number, sectionId: string) {
    setChapters((current) => current.map((chapter, chapterIndex) => (chapterIndex === index ? updateChapterSection(chapter, sectionId) : chapter)))
  }

  function addChapter() {
    if (!selectedBookId) {
      return
    }

    const firstSection = sections.find((section) => section.bookId === selectedBookId)
    setChapters((current) => [
      ...current,
      {
        id: '',
        title: '',
        bookId: selectedBookId,
        sectionId: firstSection?.id
      }
    ])
  }

  function removeChapter(index: number) {
    const chapter = chapters[index]

    if (!window.confirm(`Remove chapter "${chapter?.title || chapter?.id || 'Untitled'}"? Questions and citations that refer to this chapter may need to be updated separately.`)) {
      return
    }

    setChapters((current) => current.filter((_, chapterIndex) => chapterIndex !== index))
  }

  const selectedBookIndex = books.findIndex((book) => book.id === selectedBookId)
  const isManagingBook = Boolean(managingBookId && selectedBook)

  return (
    <form className="admin-curriculum-grid" onSubmit={submitCurriculum}>
      {!isManagingBook ? (
        <>
          <div className="admin-form-grid admin-form-grid-compact">
            <label className="control-block">
              <span>Grade Label</span>
              <input value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>
            <label className="control-block">
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>

          <label className="control-block">
            <span>Description</span>
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        </>
      ) : null}

      <div className="admin-curriculum-sections">
        {!isManagingBook ? (
          <section className="admin-row-editor">
          <div className="admin-section-header">
            <div>
              <h3>Books</h3>
              <span className="muted-copy">Create books for this grade. Sections and chapters stay hidden until you manage a specific book.</span>
            </div>
            <div className="admin-section-actions">
              <button type="button" className="preset-button" onClick={() => addBook('primary')}>
                Add Primary
              </button>
              <button type="button" className="preset-button" onClick={() => addBook('supplemental')}>
                Add Supplemental
              </button>
            </div>
          </div>

          <div className="admin-row-list">
            {books.length === 0 ? <p className="muted-copy">No books defined yet.</p> : null}
            {books.map((book, index) => (
              <div key={`${book.id}-${index}`} className="admin-edit-row admin-book-row">
                <label className="control-block">
                  <span>Type</span>
                  <select value={book.role} onChange={(event) => updateBook(index, 'role', event.target.value as CurriculumBook['role'])}>
                    <option value="primary">Primary Textbook</option>
                    <option value="supplemental">Supplementary Book</option>
                  </select>
                </label>
                <label className="control-block">
                  <span>Book Name</span>
                  <input value={book.title} onChange={(event) => updateBook(index, 'title', event.target.value)} />
                </label>
                <label className="control-block">
                  <span>Version / Issue Date</span>
                  <input value={book.edition ?? ''} onChange={(event) => updateBook(index, 'edition', event.target.value)} />
                </label>
                <label className="control-block">
                  <span>Issued</span>
                  <input type="date" value={book.issuedAt ?? ''} onChange={(event) => updateBook(index, 'issuedAt', event.target.value)} />
                </label>
                <div className="admin-row-actions" aria-label={`Book ${index + 1} actions`}>
                  <button
                    type="button"
                    className="mini-button mini-button-primary"
                    onClick={() => {
                      setSelectedBookId(book.id)
                      setManagingBookId(book.id)
                    }}
                  >
                    Manage
                  </button>
                  <button type="button" className="mini-button" disabled={index === 0} onClick={() => setBooks((current) => moveItem(current, index, -1))}>
                    Up
                  </button>
                  <button type="button" className="mini-button" disabled={index === books.length - 1} onClick={() => setBooks((current) => moveItem(current, index, 1))}>
                    Down
                  </button>
                  <button type="button" className="mini-button mini-button-danger" onClick={() => removeBook(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {isManagingBook && selectedBook ? (
          <section className="admin-focus-shell">
            <div className="admin-focus-header">
              <div>
                <span className="account-label">Manage Book</span>
                <h3>{selectedBook.title || 'Untitled Book'}</h3>
                <p className="muted-copy">
                  {selectedBook.role === 'primary' ? 'Primary textbook' : 'Supplementary book'}
                  {selectedBook.edition ? ` · ${selectedBook.edition}` : ''}
                  {selectedBook.issuedAt ? ` · Issued ${selectedBook.issuedAt}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="link-button link-button-muted"
                onClick={() => {
                  setManagingBookId(null)
                  setSelectedBookId('')
                }}
              >
                Close
              </button>
            </div>

            {selectedBookIndex >= 0 ? (
              <div className="admin-edit-row admin-book-row admin-edit-row-active">
                <label className="control-block">
                  <span>Type</span>
                  <select value={selectedBook.role} onChange={(event) => updateBook(selectedBookIndex, 'role', event.target.value as CurriculumBook['role'])}>
                    <option value="primary">Primary Textbook</option>
                    <option value="supplemental">Supplementary Book</option>
                  </select>
                </label>
                <label className="control-block">
                  <span>Book Name</span>
                  <input value={selectedBook.title} onChange={(event) => updateBook(selectedBookIndex, 'title', event.target.value)} />
                </label>
                <label className="control-block">
                  <span>Version / Issue Date</span>
                  <input value={selectedBook.edition ?? ''} onChange={(event) => updateBook(selectedBookIndex, 'edition', event.target.value)} />
                </label>
                <label className="control-block">
                  <span>Issued</span>
                  <input type="date" value={selectedBook.issuedAt ?? ''} onChange={(event) => updateBook(selectedBookIndex, 'issuedAt', event.target.value)} />
                </label>
                <div className="admin-row-actions" aria-label="Selected book actions">
                  <button type="button" className="mini-button" disabled={selectedBookIndex === 0} onClick={() => setBooks((current) => moveItem(current, selectedBookIndex, -1))}>
                    Up
                  </button>
                  <button type="button" className="mini-button" disabled={selectedBookIndex === books.length - 1} onClick={() => setBooks((current) => moveItem(current, selectedBookIndex, 1))}>
                    Down
                  </button>
                  <button type="button" className="mini-button mini-button-danger" onClick={() => removeBook(selectedBookIndex)}>
                    Remove
                  </button>
                </div>
              </div>
            ) : null}

            <div className="admin-focus-grid">
              <section className="admin-row-editor">
          <div className="admin-section-header">
            <div>
              <h3>Sections</h3>
                    <span className="muted-copy">{selectedSectionRows.length} section{selectedSectionRows.length === 1 ? '' : 's'}</span>
            </div>
            <button type="button" className="preset-button" disabled={!selectedBookId} onClick={addSection}>
              Add Section
            </button>
          </div>

          <div className="admin-row-list">
            {selectedBook && selectedSectionRows.length === 0 ? <p className="muted-copy">This book has no sections. Chapters can be added directly under the book.</p> : null}
            {selectedSectionRows.map(({ section, index }, visibleIndex) => (
              <div key={`${section.id}-${index}`} className="admin-edit-row admin-section-row">
                <label className="control-block">
                  <span>Section Name</span>
                  <input value={section.title} onChange={(event) => updateSection(index, 'title', event.target.value)} />
                </label>
                <div className="admin-row-actions" aria-label={`Section ${visibleIndex + 1} actions`}>
                  <button type="button" className="mini-button" disabled={visibleIndex === 0} onClick={() => setSections((current) => moveFilteredItem(current, selectedSectionIndexes, visibleIndex, -1))}>
                    Up
                  </button>
                  <button
                    type="button"
                    className="mini-button"
                    disabled={visibleIndex === selectedSectionRows.length - 1}
                    onClick={() => setSections((current) => moveFilteredItem(current, selectedSectionIndexes, visibleIndex, 1))}
                  >
                    Down
                  </button>
                  <button type="button" className="mini-button mini-button-danger" onClick={() => removeSection(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

              <section className="admin-row-editor">
          <div className="admin-section-header">
            <div>
              <h3>Chapters</h3>
                    <span className="muted-copy">{selectedChapterRows.length} chapter{selectedChapterRows.length === 1 ? '' : 's'}</span>
            </div>
            <button type="button" className="preset-button" disabled={!selectedBookId} onClick={addChapter}>
              Add Chapter
            </button>
          </div>

          <div className="admin-row-list">
            {selectedChapterRows.map(({ chapter, index }, visibleIndex) => (
              <div key={`${chapter.id}-${index}`} className="admin-edit-row admin-chapter-row">
                <label className="control-block">
                  <span>ID</span>
                  <input value={chapter.id} onChange={(event) => updateChapter(index, 'id', event.target.value)} />
                </label>
                <label className="control-block">
                  <span>Title</span>
                  <input value={chapter.title} onChange={(event) => updateChapter(index, 'title', event.target.value)} />
                </label>
                <label className="control-block">
                  <span>Section</span>
                  <select value={chapter.sectionId ?? ''} onChange={(event) => updateChapterSectionField(index, event.target.value)}>
                    <option value="">No section</option>
                    {selectedSectionRows.map(({ section }) => (
                      <option key={section.id} value={section.id}>
                        {section.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-row-actions" aria-label={`Chapter ${visibleIndex + 1} actions`}>
                  <button type="button" className="mini-button" disabled={visibleIndex === 0} onClick={() => setChapters((current) => moveFilteredItem(current, selectedChapterIndexes, visibleIndex, -1))}>
                    Up
                  </button>
                  <button
                    type="button"
                    className="mini-button"
                    disabled={visibleIndex === selectedChapterRows.length - 1}
                    onClick={() => setChapters((current) => moveFilteredItem(current, selectedChapterIndexes, visibleIndex, 1))}
                  >
                    Down
                  </button>
                  <button type="button" className="mini-button mini-button-danger" onClick={() => removeChapter(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
            </div>
        </section>
        ) : null}
      </div>

      <div className="admin-action-row">
        <label className="control-block admin-reason-field">
          <span>Change Reason</span>
          <input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <button type="submit" className="start-session-button start-session-button-compact" disabled={saveMutation.isPending || curriculumQuery.isLoading || reason.trim().length < 3}>
          Save Curriculum
        </button>
      </div>

      {curriculumQuery.isError ? <p className="form-error">Unable to load Admin curriculum: {curriculumQuery.error.message}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}
      {saveMutation.isError ? <p className="form-error">{saveMutation.error.message}</p> : null}
      {saveMutation.isSuccess ? <p className="form-success">Curriculum saved.</p> : null}
    </form>
  )
}

function AdminReferencesPanel({ grade, payload }: { grade: GradeIndexEntry; payload: StudyPayload }) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState(grade.label)
  const [title, setTitle] = useState(payload.title ?? '')
  const [description, setDescription] = useState(payload.description ?? '')
  const [books, setBooks] = useState<CurriculumBook[]>(payload.books ?? [])
  const [sections, setSections] = useState<CurriculumSection[]>(payload.sections ?? [])
  const [chapters, setChapters] = useState<Chapter[]>(payload.chapters ?? [])
  const [references, setReferences] = useState<StudyReference[]>(payload.references ?? [])
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const curriculumQuery = useQuery({
    queryKey: ['admin', 'curriculum', grade.id],
    queryFn: () => loadAdminCurriculum(grade.id),
    retry: false
  })

  useEffect(() => {
    const curriculum = curriculumQuery.data

    setLabel(curriculum?.label ?? grade.label)
    setTitle(curriculum?.title ?? payload.title ?? '')
    setDescription(curriculum?.description ?? payload.description ?? '')
    setBooks(curriculum?.books ?? payload.books ?? [])
    setSections(curriculum?.sections ?? payload.sections ?? [])
    setChapters(curriculum?.chapters ?? payload.chapters ?? [])
    setReferences(curriculum?.referenceLinks ?? payload.references ?? [])
    setReason('')
    setFormError(null)
  }, [curriculumQuery.data, grade.id, grade.label, payload.books, payload.chapters, payload.description, payload.references, payload.sections, payload.title])

  const saveMutation = useMutation({
    mutationFn: (input: AdminCurriculumInput) => saveAdminCurriculum(grade.id, input),
    onSuccess: (curriculum) => {
      queryClient.setQueryData(['admin', 'curriculum', grade.id], curriculum)
      queryClient.invalidateQueries({ queryKey: ['study-payload', grade.id] })
      setReason('')
      setFormError(null)
    }
  })

  function updateReference<Key extends keyof StudyReference>(index: number, field: Key, value: StudyReference[Key]) {
    setReferences((current) => current.map((reference, referenceIndex) => (referenceIndex === index ? { ...reference, [field]: value } : reference)))
  }

  function updateReferenceScope(index: number, scope: StudyReference['scope']) {
    setReferences((current) =>
      current.map((reference, referenceIndex) =>
        referenceIndex === index
          ? {
              ...reference,
              scope,
              bookId: undefined,
              sectionId: undefined,
              chapterId: undefined
            }
          : reference
      )
    )
  }

  function addReference() {
    setReferences((current) => [
      ...current,
      {
        id: buildReferenceId('new-reference', current),
        title: '',
        href: '',
        description: '',
        resourceType: 'website',
        importance: 'recommended',
        scope: 'grade'
      }
    ])
  }

  function removeReference(index: number) {
    const reference = references[index]

    if (!window.confirm(`Remove reference "${reference?.title || reference?.id || 'Untitled'}"?`)) {
      return
    }

    setReferences((current) => current.filter((_, referenceIndex) => referenceIndex !== index))
  }

  function submitReferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      validateCurriculumRows(books, sections, chapters, references)

      const renamedReferences = findRenamedRows(curriculumQuery.data?.referenceLinks ?? payload.references ?? [], references, 'Reference renamed')
      if (renamedReferences.length > 0 && !window.confirm(`Confirm reference rename changes before saving.\\n\\n${renamedReferences.join('\\n')}`)) {
        return
      }

      setFormError(null)
      saveMutation.mutate({
        label,
        title: textOrUndefined(title),
        description: textOrUndefined(description),
        reason,
        books: normalizeBooks(books),
        sections: normalizeSections(sections),
        chapters: normalizeChapters(chapters),
        referenceLinks: normalizeReferences(references)
      })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save references')
    }
  }

  return (
    <form className="admin-curriculum-grid" onSubmit={submitReferences}>
      <section className="admin-row-editor">
        <div className="admin-section-header">
          <div>
            <h3>References</h3>
            <span className="muted-copy">{references.length} reference{references.length === 1 ? '' : 's'} for {grade.label}</span>
          </div>
          <button type="button" className="preset-button" onClick={addReference}>
            Add Reference
          </button>
        </div>

        <div className="admin-row-list">
          {references.length === 0 ? <p className="muted-copy">No references defined yet.</p> : null}
          {references.map((reference, index) => (
            <div key={`${reference.id}-${index}`} className="admin-edit-row admin-reference-row">
              <label className="control-block">
                <span>Title</span>
                <input value={reference.title} onChange={(event) => updateReference(index, 'title', event.target.value)} />
              </label>
              <label className="control-block admin-reference-url">
                <span>URL</span>
                <input value={reference.href ?? ''} onChange={(event) => updateReference(index, 'href', event.target.value)} />
              </label>
              <label className="control-block">
                <span>Type</span>
                <select value={reference.resourceType} onChange={(event) => updateReference(index, 'resourceType', event.target.value as StudyReference['resourceType'])}>
                  {referenceResourceTypeOptions.map((resourceType) => (
                    <option key={resourceType} value={resourceType}>
                      {formatType(resourceType)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="control-block">
                <span>Importance</span>
                <select value={reference.importance} onChange={(event) => updateReference(index, 'importance', event.target.value as StudyReference['importance'])}>
                  {referenceImportanceOptions.map((importance) => (
                    <option key={importance} value={importance}>
                      {importance}
                    </option>
                  ))}
                </select>
              </label>
              <label className="control-block">
                <span>Scope</span>
                <select value={reference.scope} onChange={(event) => updateReferenceScope(index, event.target.value as StudyReference['scope'])}>
                  {referenceScopeOptions.map((scope) => (
                    <option key={scope} value={scope}>
                      {scope}
                    </option>
                  ))}
                </select>
              </label>
              {reference.scope === 'book' ? (
                <label className="control-block">
                  <span>Book</span>
                  <select value={reference.bookId ?? ''} onChange={(event) => updateReference(index, 'bookId', event.target.value)}>
                    <option value="">Select book</option>
                    {books.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {reference.scope === 'section' ? (
                <label className="control-block">
                  <span>Section</span>
                  <select value={reference.sectionId ?? ''} onChange={(event) => updateReference(index, 'sectionId', event.target.value)}>
                    <option value="">Select section</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {reference.scope === 'chapter' ? (
                <label className="control-block">
                  <span>Chapter</span>
                  <select value={reference.chapterId ?? ''} onChange={(event) => updateReference(index, 'chapterId', event.target.value)}>
                    <option value="">Select chapter</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.id} {chapter.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="control-block admin-reference-description">
                <span>Description</span>
                <input value={reference.description ?? ''} onChange={(event) => updateReference(index, 'description', event.target.value)} />
              </label>
              <div className="admin-row-actions" aria-label={`Reference ${index + 1} actions`}>
                <button type="button" className="mini-button" disabled={index === 0} onClick={() => setReferences((current) => moveItem(current, index, -1))}>
                  Up
                </button>
                <button type="button" className="mini-button" disabled={index === references.length - 1} onClick={() => setReferences((current) => moveItem(current, index, 1))}>
                  Down
                </button>
                <button type="button" className="mini-button mini-button-danger" onClick={() => removeReference(index)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-action-row">
        <label className="control-block admin-reason-field">
          <span>Change Reason</span>
          <input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <button type="submit" className="start-session-button start-session-button-compact" disabled={saveMutation.isPending || curriculumQuery.isLoading || reason.trim().length < 3}>
          Save References
        </button>
      </div>

      {curriculumQuery.isError ? <p className="form-error">Unable to load Admin references: {curriculumQuery.error.message}</p> : null}
      {formError ? <p className="form-error">{formError}</p> : null}
      {saveMutation.isError ? <p className="form-error">{saveMutation.error.message}</p> : null}
      {saveMutation.isSuccess ? <p className="form-success">References saved.</p> : null}
    </form>
  )
}

function AdminQuestionPanel({ grade, books, chapters, references }: { grade: GradeIndexEntry; books: CurriculumBook[]; chapters: ChapterChoice[]; references: StudyReference[] }) {
  const queryClient = useQueryClient()
  const [selectedBookId, setSelectedBookId] = useState(books[0]?.id ?? '')
  const [managingBookId, setManagingBookId] = useState<string | null>(null)
  const managedChapters = useMemo(() => (managingBookId ? chapters.filter((chapter) => chapter.bookId === managingBookId) : []), [chapters, managingBookId])
  const defaultChapter = managedChapters[0]?.id ?? chapters[0]?.id ?? ''
  const [search, setSearch] = useState('')
  const [chapterFilter, setChapterFilter] = useState('')
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)
  const [form, setForm] = useState<QuestionFormState>(() => emptyQuestionForm(defaultChapter))
  const [formError, setFormError] = useState<string | null>(null)

  const questionsQuery = useQuery({
    queryKey: ['admin', 'questions', grade.id],
    queryFn: () => loadAdminQuestions(grade.id),
    retry: false
  })

  const questions = useMemo(() => sortAdminQuestions(questionsQuery.data ?? []), [questionsQuery.data])
  const selectedQuestion = useMemo(() => questions.find((question) => question.id === selectedQuestionId), [questions, selectedQuestionId])
  const managedChapterIds = useMemo(() => new Set(managedChapters.map((chapter) => chapter.id)), [managedChapters])
  const scopedQuestions = useMemo(() => (managingBookId ? questions.filter((question) => managedChapterIds.has(question.chapterId)) : []), [managedChapterIds, managingBookId, questions])
  const chapterScopedQuestions = useMemo(() => (chapterFilter ? scopedQuestions.filter((question) => question.chapterId === chapterFilter) : scopedQuestions), [chapterFilter, scopedQuestions])
  const selectedBookChapters = useMemo(() => (selectedBookId ? chapters.filter((chapter) => chapter.bookId === selectedBookId) : []), [chapters, selectedBookId])
  const selectedBookQuestionCount = useMemo(() => {
    const selectedBookChapterIds = new Set(selectedBookChapters.map((chapter) => chapter.id))
    return questions.filter((question) => selectedBookChapterIds.has(question.chapterId)).length
  }, [questions, selectedBookChapters])
  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) {
      return chapterScopedQuestions
    }

    return chapterScopedQuestions.filter((question) => {
      const chapterLabel = getChapterDisplayName(chapters, question.chapterId)
      return [question.id, question.chapterId, chapterLabel, question.questionType, question.status, question.question, question.answer ?? ''].some((value) => value.toLowerCase().includes(term))
    })
  }, [chapterScopedQuestions, chapters, search])

  useEffect(() => {
    setSelectedQuestionId(null)
    setForm(emptyQuestionForm(defaultChapter))
    setChapterFilter('')
    setFormError(null)
  }, [defaultChapter, grade.id])

  useEffect(() => {
    if (books.length === 0) {
      setSelectedBookId('')
      setManagingBookId(null)
      return
    }

    if (!books.some((book) => book.id === selectedBookId)) {
      setSelectedBookId(books[0]?.id ?? '')
    }

    if (managingBookId && !books.some((book) => book.id === managingBookId)) {
      setManagingBookId(null)
      setChapterFilter('')
    }
  }, [books, managingBookId, selectedBookId])

  useEffect(() => {
    if (selectedQuestion) {
      setForm(questionToForm(selectedQuestion))
      setFormError(null)
    }
  }, [selectedQuestion])

  const createMutation = useMutation({
    mutationFn: (input: AdminQuestionInput) => createAdminQuestion(grade.id, input),
    onSuccess: (question) => applyQuestionMutationSuccess(question)
  })

  const updateMutation = useMutation({
    mutationFn: ({ questionId, input }: { questionId: string; input: AdminQuestionInput }) => updateAdminQuestion(grade.id, questionId, input),
    onSuccess: (question) => applyQuestionMutationSuccess(question)
  })

  function applyQuestionMutationSuccess(question: AdminQuestion) {
    queryClient.setQueryData<AdminQuestion[]>(['admin', 'questions', grade.id], (current) => sortAdminQuestions([...(current ?? []).filter((entry) => entry.id !== question.id), question]))
    queryClient.invalidateQueries({ queryKey: ['study-payload', grade.id] })
    setSelectedQuestionId(question.id)
    setForm(questionToForm(question))
    setFormError(null)
  }

  function updateForm<Key extends keyof QuestionFormState>(key: Key, value: QuestionFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function getFirstChapterIdForBook(bookId: string): string {
    return chapters.find((chapter) => chapter.bookId === bookId)?.id ?? ''
  }

  function openQuestionManagement(bookId: string) {
    const nextChapterId = getFirstChapterIdForBook(bookId)

    setSelectedBookId(bookId)
    setManagingBookId(bookId)
    setSelectedQuestionId(null)
    setSearch('')
    setChapterFilter('')
    setForm(emptyQuestionForm(nextChapterId))
    setFormError(null)
  }

  function updateQuestionType(questionType: string) {
    setForm((current) => {
      if (questionType === 'true_false') {
        return {
          ...current,
          questionType,
          options: joinOptions(trueFalseOptions),
          answer: normalizeTrueFalseAnswer(current.answer)
        }
      }

      if (questionType === 'mcq') {
        const options = editableOptionLines(current.options)
        const answer = options.includes(current.answer.trim()) ? current.answer.trim() : ''

        return {
          ...current,
          questionType,
          answer
        }
      }

      return {
        ...current,
        questionType
      }
    })
  }

  function updateQuestionChapter(chapterId: string) {
    setForm((current) => ({
      ...current,
      chapterId
    }))
  }

  function updateSingleChoiceAnswer(answer: string) {
    setForm((current) => ({
      ...current,
      answer
    }))
  }

  function updateMcqOption(index: number, value: string) {
    setForm((current) => {
      const options = editableOptionLines(current.options)
      const previousValue = options[index] ?? ''
      const nextOptions = options.map((option, optionIndex) => (optionIndex === index ? value : option))

      return {
        ...current,
        options: joinOptions(nextOptions),
        answer: current.answer === previousValue ? value : current.answer
      }
    })
  }

  function addMcqOption() {
    setForm((current) => ({
      ...current,
      options: joinOptions([...editableOptionLines(current.options), ''])
    }))
  }

  function removeMcqOption(index: number) {
    const removedOption = editableOptionLines(form.options)[index] ?? ''

    if (removedOption && !window.confirm(`Remove option "${removedOption}"?`)) {
      return
    }

    setForm((current) => {
      const options = editableOptionLines(current.options)
      const currentRemovedOption = options[index] ?? ''

      return {
        ...current,
        options: joinOptions(options.filter((_, optionIndex) => optionIndex !== index)),
        answer: current.answer === currentRemovedOption ? '' : current.answer
      }
    })
  }

  function updateCitation<Key extends keyof CitationFormState>(index: number, field: Key, value: CitationFormState[Key]) {
    setForm((current) => ({
      ...current,
      citations: current.citations.map((citation, citationIndex) => (citationIndex === index ? { ...citation, [field]: value } : citation))
    }))
  }

  function addCitation() {
    setForm((current) => ({
      ...current,
      citations: [
        ...current.citations,
        {
          sourceType: 'book',
          bookId: managedChapters.find((chapter) => chapter.id === current.chapterId)?.bookId ?? managingBookId ?? '',
          chapterId: managedChapters.some((chapter) => chapter.id === current.chapterId) ? current.chapterId : (managedChapters[0]?.id ?? ''),
          referenceId: '',
          page: '',
          pageEnd: '',
          excerpt: ''
        }
      ]
    }))
  }

  function removeCitation(index: number) {
    if (!window.confirm('Remove this citation from the question?')) {
      return
    }

    setForm((current) => ({
      ...current,
      citations: current.citations.filter((_, citationIndex) => citationIndex !== index)
    }))
  }

  function resetForNewQuestion() {
    setSelectedQuestionId(null)
    setForm(emptyQuestionForm(chapterFilter || defaultChapter))
    setFormError(null)
  }

  function closeQuestionManagement() {
    setManagingBookId(null)
    setSelectedQuestionId(null)
    setSearch('')
    setChapterFilter('')
    setForm(emptyQuestionForm(defaultChapter))
    setFormError(null)
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const input = formToQuestionInput(form)
      setFormError(null)

      if (selectedQuestion) {
        updateMutation.mutate({ questionId: selectedQuestion.id, input })
      } else {
        createMutation.mutate(input)
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save question')
    }
  }

  function archiveQuestion() {
    if (!selectedQuestion) {
      return
    }

    try {
      const input = formToQuestionInput({ ...form, status: 'archived' })
      setFormError(null)
      updateMutation.mutate({ questionId: selectedQuestion.id, input })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to archive question')
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const selectedBook = books.find((book) => book.id === selectedBookId)
  const managingBook = books.find((book) => book.id === managingBookId)
  const isSingleChoiceQuestion = isSingleChoiceType(form.questionType)
  const singleChoiceOptionRows = form.questionType === 'true_false' ? trueFalseOptions : editableOptionLines(form.options)
  const singleChoiceAnswer = form.questionType === 'true_false' ? normalizeTrueFalseAnswer(form.answer) : form.answer.trim()
  const hasValidAnswerSelection = hasSingleChoiceAnswer(form)
  const typeOptions = Array.from(new Set([...questionTypeOptions, form.questionType].filter(Boolean)))
  const difficultySelectOptions = Array.from(new Set([...difficultyOptions, form.difficulty].filter(Boolean)))

  return (
    <div className="admin-question-shell">
      {!managingBookId ? (
        <section className="admin-row-editor">
          <div className="admin-section-header">
            <div>
              <h3>Questions</h3>
              <span className="muted-copy">Choose a book before opening the question list and editor.</span>
            </div>
            <button
              type="button"
              className="preset-button"
              disabled={!selectedBookId || chapters.filter((chapter) => chapter.bookId === selectedBookId).length === 0}
	              onClick={() => openQuestionManagement(selectedBookId)}
            >
              Manage Questions
            </button>
          </div>
          <div className="admin-form-grid admin-form-grid-compact">
            <label className="control-block">
              <span>Book</span>
              <select value={selectedBookId} onChange={(event) => setSelectedBookId(event.target.value)} disabled={books.length === 0}>
                <option value="">No book available</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="admin-summary-strip">
              <span>{selectedBook?.role === 'primary' ? 'Primary textbook' : selectedBook ? 'Supplementary book' : 'No book selected'}</span>
              <strong>{selectedBookChapters.length} chapters</strong>
              <strong>{selectedBookQuestionCount} questions</strong>
            </div>
          </div>
          {books.length === 0 ? <p className="muted-copy">Add a book and chapters in Curriculum before managing questions for this grade.</p> : null}
        </section>
      ) : (
        <section className="admin-focus-shell">
	          <div className="admin-focus-header">
	            <div>
	              <span className="account-label">Manage Questions</span>
	              <h3>{managingBook?.title ?? managingBookId}</h3>
	              <p className="muted-copy">{managedChapters.length} chapter{managedChapters.length === 1 ? '' : 's'} in this book</p>
	            </div>
	            <div className="admin-focus-actions">
	              <label className="control-block admin-focus-book-select">
	                <span>Book</span>
	                <select value={managingBookId} onChange={(event) => openQuestionManagement(event.target.value)}>
	                  {books.map((book) => (
	                    <option key={book.id} value={book.id}>
	                      {book.title}
	                    </option>
	                  ))}
	                </select>
	              </label>
	              <button type="button" className="link-button link-button-muted" onClick={closeQuestionManagement}>
	                Close
	              </button>
	            </div>
	          </div>

          <div className="admin-question-grid">
      <section className="admin-list-column">
	        <div className="admin-list-toolbar">
	          <label className="control-block admin-search-field">
	            <span>Search</span>
	            <input value={search} onChange={(event) => setSearch(event.target.value)} />
	          </label>
	          <button type="button" className="preset-button" onClick={resetForNewQuestion}>
	            New
	          </button>
	        </div>
	        <label className="control-block">
	          <span>Chapter</span>
	          <select
	            value={chapterFilter}
	            onChange={(event) => {
	              setChapterFilter(event.target.value)
	              setSelectedQuestionId(null)
	            }}
	          >
	            <option value="">All chapters</option>
	            {managedChapters.map((chapter) => (
	              <option key={chapter.id} value={chapter.id}>
	                {chapter.id} {chapter.title}
	              </option>
	            ))}
	          </select>
	        </label>

	        <div className="admin-list-summary">
	          <strong>{filteredQuestions.length}</strong>
	          <span>of {chapterScopedQuestions.length} in this {chapterFilter ? 'chapter' : 'book'}</span>
	        </div>

        <div className="admin-question-list">
          {questionsQuery.isLoading ? <p className="muted-copy">Loading questions.</p> : null}
          {questionsQuery.isError ? <p className="form-error">Unable to load Admin questions: {questionsQuery.error.message}</p> : null}
          {!questionsQuery.isLoading && filteredQuestions.length === 0 ? <p className="muted-copy">No questions match this search.</p> : null}
          {filteredQuestions.map((question) => (
            <button
              key={question.id}
              type="button"
              className={selectedQuestionId === question.id ? 'admin-question-row admin-question-row-active' : 'admin-question-row'}
              onClick={() => setSelectedQuestionId(question.id)}
            >
              <span className="admin-question-row-top">
                <strong>{getChapterDisplayName(chapters, question.chapterId)}</strong>
                <span className={`admin-status admin-status-${question.status}`}>{question.status}</span>
              </span>
              <span>{question.question}</span>
            </button>
          ))}
        </div>
      </section>

      <form className="admin-editor" onSubmit={submitQuestion}>
        <div className="admin-editor-heading">
          <div>
            <h3>{selectedQuestion ? 'Edit Question' : 'New Question'}</h3>
            <span className="muted-copy">{selectedQuestion?.id ?? grade.label}</span>
          </div>
          {selectedQuestion?.version ? <span className="muted-chip">v{selectedQuestion.version}</span> : null}
        </div>

        <div className="admin-form-grid admin-form-grid-compact">
          <label className="control-block">
            <span>Status</span>
            <select value={form.status} onChange={(event) => updateForm('status', event.target.value as AdminQuestion['status'])}>
              <option value="unrated">unrated</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </label>

	          <label className="control-block">
	            <span>Type</span>
	            <select value={form.questionType} onChange={(event) => updateQuestionType(event.target.value)}>
	              {typeOptions.map((questionType) => (
	                <option key={questionType} value={questionType}>
	                  {formatType(questionType)}
	                </option>
	              ))}
	            </select>
	          </label>

          <label className="control-block">
            <span>Chapter</span>
            <select value={form.chapterId} onChange={(event) => updateQuestionChapter(event.target.value)}>
              {managedChapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.id} {chapter.title}
                </option>
              ))}
            </select>
          </label>

	          <label className="control-block">
	            <span>Difficulty</span>
	            <select value={form.difficulty} onChange={(event) => updateForm('difficulty', event.target.value)}>
	              <option value="">No difficulty</option>
	              {difficultySelectOptions.map((difficulty) => (
	                <option key={difficulty} value={difficulty}>
	                  {difficulty}
	                </option>
	              ))}
	            </select>
	          </label>
	        </div>

        <label className="control-block">
          <span>Question</span>
          <textarea rows={4} value={form.question} onChange={(event) => updateForm('question', event.target.value)} />
        </label>

	        {isSingleChoiceQuestion ? (
	          <section className="admin-choice-editor">
	            <div className="admin-section-header">
	              <div>
	                <h3>Options</h3>
	                <span className="muted-copy">Answer is derived from the selected correct option.</span>
	              </div>
	              {form.questionType === 'mcq' ? (
	                <button type="button" className="preset-button" onClick={addMcqOption}>
	                  Add Option
	                </button>
	              ) : null}
	            </div>
	            <div className="admin-choice-list">
	              {singleChoiceOptionRows.map((option, index) => (
	                <div key={`option-${index}`} className="admin-choice-row">
	                  <label className="admin-choice-radio">
	                    <input type="radio" name="correct-option" checked={singleChoiceAnswer === option && option.trim().length > 0} disabled={!option.trim()} onChange={() => updateSingleChoiceAnswer(option)} />
	                    <span>Correct</span>
	                  </label>
	                  {form.questionType === 'true_false' ? (
	                    <span className="admin-choice-static">{option}</span>
	                  ) : (
	                    <input value={option} onChange={(event) => updateMcqOption(index, event.target.value)} />
	                  )}
	                  {form.questionType === 'mcq' ? (
	                    <button type="button" className="mini-button mini-button-danger" onClick={() => removeMcqOption(index)}>
	                      Remove
	                    </button>
	                  ) : null}
	                </div>
	              ))}
	              {form.questionType === 'mcq' && singleChoiceOptionRows.length === 0 ? <p className="muted-copy">Add at least two options and select the correct one.</p> : null}
	            </div>
	            <div className="admin-derived-answer">
	              <span>Answer</span>
	              <strong>{hasValidAnswerSelection ? singleChoiceAnswer : 'Select a correct option'}</strong>
	            </div>
	            {!hasValidAnswerSelection ? <p className="form-error">Select the correct option before saving.</p> : null}
	          </section>
	        ) : (
	          <>
	            <label className="control-block">
	              <span>Options</span>
	              <textarea rows={4} value={form.options} onChange={(event) => updateForm('options', event.target.value)} />
	            </label>

	            <div className="admin-form-grid">
	              <label className="control-block">
	                <span>Answer</span>
	                <textarea rows={5} value={form.answer} onChange={(event) => updateForm('answer', event.target.value)} />
	              </label>
	              <label className="control-block">
	                <span>Explanation</span>
	                <textarea rows={5} value={form.explanation} onChange={(event) => updateForm('explanation', event.target.value)} />
	              </label>
	            </div>
	          </>
	        )}

	        {isSingleChoiceQuestion ? (
	          <label className="control-block">
	            <span>Explanation</span>
	            <textarea rows={5} value={form.explanation} onChange={(event) => updateForm('explanation', event.target.value)} />
	          </label>
	        ) : null}

        <section className="admin-citation-editor">
          <div className="admin-section-header">
            <div>
              <h3>Citations</h3>
              <span className="muted-copy">Citations can point to a book, chapter, reference, or teacher note. Page fields are optional.</span>
            </div>
            <button type="button" className="preset-button" onClick={addCitation}>
              Add Citation
            </button>
          </div>

          <div className="admin-row-list">
            {form.citations.length === 0 ? <p className="muted-copy">No citations defined for this question.</p> : null}
            {form.citations.map((citation, index) => (
              <div key={`citation-${index}`} className="admin-edit-row admin-citation-row">
                <label className="control-block">
                  <span>Type</span>
                  <select value={citation.sourceType} onChange={(event) => updateCitation(index, 'sourceType', event.target.value as QuestionCitation['sourceType'])}>
                    {citationSourceTypeOptions.map((sourceType) => (
                      <option key={sourceType} value={sourceType}>
                        {formatType(sourceType)}
                      </option>
                    ))}
                  </select>
                </label>
	                <label className="control-block">
	                  <span>Book</span>
	                  <select value={citation.bookId} onChange={(event) => updateCitation(index, 'bookId', event.target.value)}>
	                    <option value="">No book</option>
	                    {managingBook ? <option value={managingBook.id}>{managingBook.title}</option> : null}
	                  </select>
	                </label>
                <label className="control-block">
                  <span>Chapter</span>
                  <select value={citation.chapterId} onChange={(event) => updateCitation(index, 'chapterId', event.target.value)}>
                    <option value="">No chapter</option>
                    {managedChapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.id} {chapter.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="control-block">
                  <span>Reference</span>
                  <select value={citation.referenceId} onChange={(event) => updateCitation(index, 'referenceId', event.target.value)}>
                    <option value="">No reference</option>
                    {references.map((reference) => (
                      <option key={reference.id} value={reference.id}>
                        {reference.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="control-block">
                  <span>Page</span>
                  <input value={citation.page} onChange={(event) => updateCitation(index, 'page', event.target.value)} />
                </label>
                <label className="control-block">
                  <span>End Page</span>
                  <input value={citation.pageEnd} onChange={(event) => updateCitation(index, 'pageEnd', event.target.value)} />
                </label>
                <label className="control-block">
                  <span>Excerpt</span>
                  <input value={citation.excerpt} onChange={(event) => updateCitation(index, 'excerpt', event.target.value)} />
                </label>
                <div className="admin-row-actions" aria-label={`Citation ${index + 1} actions`}>
                  <button type="button" className="mini-button mini-button-danger" onClick={() => removeCitation(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="admin-warning-grid">
          <label className="admin-checkbox">
            <input type="checkbox" checked={form.warningActive} onChange={(event) => updateForm('warningActive', event.target.checked)} />
            <span>Warning Active</span>
          </label>
          <label className="control-block">
            <span>Warning Label</span>
            <input value={form.warningLabel} onChange={(event) => updateForm('warningLabel', event.target.value)} />
          </label>
          <label className="control-block">
            <span>Warning Reason</span>
            <input value={form.warningReason} onChange={(event) => updateForm('warningReason', event.target.value)} />
          </label>
        </div>

        <div className="admin-action-row">
          <label className="control-block admin-reason-field">
            <span>Change Reason</span>
            <input value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} />
          </label>
          <button type="submit" className="start-session-button start-session-button-compact" disabled={isSaving || form.reason.trim().length < 3}>
            {selectedQuestion ? 'Save Question' : 'Create Question'}
          </button>
          <button
            type="button"
            className="card-action-button card-action-button-bad"
            disabled={!selectedQuestion || selectedQuestion.status === 'archived' || isSaving || form.reason.trim().length < 3}
            onClick={archiveQuestion}
          >
            Archive
          </button>
        </div>

        {formError ? <p className="form-error">{formError}</p> : null}
        {createMutation.isError ? <p className="form-error">{createMutation.error.message}</p> : null}
        {updateMutation.isError ? <p className="form-error">{updateMutation.error.message}</p> : null}
        {createMutation.isSuccess || updateMutation.isSuccess ? <p className="form-success">Question saved.</p> : null}
      </form>
          </div>
        </section>
      )}
    </div>
  )
}

function SetupPanel({
  chapters,
  selectedChapters,
  quizSize,
  selectedPoolCount,
  onQuizSizeChange,
  onSelectedChaptersChange,
  onStartSession
}: {
  chapters: ChapterChoice[]
  selectedChapters: string[]
  quizSize: number
  selectedPoolCount: number
  onQuizSizeChange: (value: number) => void
  onSelectedChaptersChange: (chapters: string[]) => void
  onStartSession: () => void
}) {
  const groupedChapters = useMemo(() => {
    const groups = new Map<string, ChapterChoice[]>()
    chapters.forEach((chapter) => {
      const group = chapter.group ?? 'Study Chapters'
      groups.set(group, [...(groups.get(group) ?? []), chapter])
    })
    return Array.from(groups.entries())
  }, [chapters])

  function toggleChapter(chapterId: string, checked: boolean) {
    const nextChapters = checked
      ? [...selectedChapters, chapterId]
      : selectedChapters.filter((selectedChapterId) => selectedChapterId !== chapterId)
    onSelectedChaptersChange(Array.from(new Set(nextChapters)))
  }

  return (
    <section className="panel setup-panel">
      <div className="panel-heading setup-heading">
        <div>
          <h2>Study Session</h2>
          <span className="muted-copy">Choose chapters and a question count.</span>
        </div>
        <div className="panel-heading-actions">
          <span className="muted-chip">
            {selectedChapters.length} chapters selected · {selectedPoolCount} questions available
          </span>
          <button type="button" className="start-session-button start-session-button-compact" disabled={selectedPoolCount === 0} onClick={onStartSession}>
            Start
          </button>
        </div>
      </div>

      <div className="setup-grid">
        <div className="setup-card question-count-card">
          <label className="control-block">
            <span>Questions</span>
            <input
              id="quiz-size"
              type="number"
              min="1"
              max={Math.max(1, selectedPoolCount)}
              value={quizSize}
              onChange={(event) => onQuizSizeChange(Number(event.target.value) || 1)}
            />
          </label>

          <div className="preset-row">
            {[10, 25, 50].map((preset) => (
              <button key={preset} type="button" className="preset-button" onClick={() => onQuizSizeChange(preset)}>
                {preset}
              </button>
            ))}
            <button type="button" className="preset-button preset-button-primary" onClick={() => onQuizSizeChange(Math.max(1, selectedPoolCount))}>
              All
            </button>
          </div>
        </div>

        <div className="setup-card chapter-picker-card">
          <div className="setup-header">
            <h3>Chapters</h3>
            <div className="setup-actions">
              <button type="button" className="link-button" onClick={() => onSelectedChaptersChange(chapters.map((chapter) => chapter.id))}>
                Select All
              </button>
              <button type="button" className="link-button link-button-muted" onClick={() => onSelectedChaptersChange([])}>
                Clear
              </button>
            </div>
          </div>

          <div className="chapters-grid">
            {groupedChapters.map(([group, groupChapters]) => (
              <section key={group} className="chapter-group">
                <h4>{group}</h4>
                <div className="chapter-choice-list">
                  {groupChapters.map((chapter) => (
                    <label key={chapter.id} className="chapter-choice">
                      <input type="checkbox" checked={selectedChapters.includes(chapter.id)} onChange={(event) => toggleChapter(chapter.id, event.target.checked)} />
                      <span className="chapter-choice-text">
                        <strong>{chapter.id}</strong>
                        <span>{chapter.title}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <div className="setup-footer">
        <button type="button" className="start-session-button" disabled={selectedPoolCount === 0} onClick={onStartSession}>
          Start Study Session
        </button>
      </div>
    </section>
  )
}

function SessionPanel({
  chapters,
  references,
  sessionStarted,
  questions,
  activeQuestionIndex,
  questionProgress,
  onReveal,
  onGrade,
  onRepeatMissed,
  onExit,
  onNavigate
}: {
  chapters: ChapterChoice[]
  references: StudyReference[]
  sessionStarted: boolean
  questions: StudyQuestion[]
  activeQuestionIndex: number
  questionProgress: Record<string, QuestionProgress>
  onReveal: (questionId: string) => void
  onGrade: (questionId: string, selfGrade: SelfGrade) => void
  onRepeatMissed: () => void
  onExit: () => void
  onNavigate: (index: number) => void
}) {
  const missedCount = questions.filter((question) => questionProgress[question.id]?.selfGrade === 'incorrect').length

  return (
    <section className="panel featured-panel" hidden={!sessionStarted}>
      <div className="panel-heading">
        <h2>Study Question</h2>
        <div className="panel-heading-actions">
          <button type="button" className="link-button link-button-muted" disabled={missedCount === 0} onClick={onRepeatMissed}>
            Repeat Missed
          </button>
          <button type="button" className="link-button link-button-muted" onClick={onExit}>
            Exit Session
          </button>
          <span className="muted-chip">{questions.length} in session</span>
        </div>
      </div>

      <div className="question-grid">
        {questions.length > 0 ? (
          <ActiveQuestion
            chapters={chapters}
            references={references}
            question={questions[Math.min(activeQuestionIndex, questions.length - 1)]}
            index={Math.min(activeQuestionIndex, questions.length - 1)}
            total={questions.length}
            questions={questions}
            questionProgress={questionProgress}
            onReveal={onReveal}
            onGrade={onGrade}
            onComplete={onExit}
            onNavigate={onNavigate}
          />
        ) : (
          <div className="empty-state">
            <strong>No questions available.</strong>
            <p className="muted-copy">Select at least one chapter with available questions.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function ActiveQuestion({
  chapters,
  references,
  question,
  index,
  total,
  questions,
  questionProgress,
  onReveal,
  onGrade,
  onComplete,
  onNavigate
}: {
  chapters: ChapterChoice[]
  references: StudyReference[]
  question: StudyQuestion
  index: number
  total: number
  questions: StudyQuestion[]
  questionProgress: Record<string, QuestionProgress>
  onReveal: (questionId: string) => void
  onGrade: (questionId: string, selfGrade: SelfGrade) => void
  onComplete: () => void
  onNavigate: (index: number) => void
}) {
  const progress = questionProgress[question.id] ?? { revealed: false, selfGrade: null }
  const answered = questions.filter((sessionQuestion) => questionProgress[sessionQuestion.id]?.selfGrade !== null).length
  const acceptable = questions.filter((sessionQuestion) => questionProgress[sessionQuestion.id]?.selfGrade === 'acceptable').length
  const incorrect = questions.filter((sessionQuestion) => questionProgress[sessionQuestion.id]?.selfGrade === 'incorrect').length
  const percent = total > 0 ? Math.round((answered / total) * 100) : 0
  const difficulty = formatDifficulty(question.difficulty)
  const teacherRatingCount = question.ratings?.teacher?.count ?? 0
  const studentRatingCount = question.ratings?.student?.count ?? 0

  return (
    <>
      <div className="session-progress">
        <div className="session-progress-top">
          <strong>
            Question {index + 1} of {total}
          </strong>
          <span>
            {answered}/{total} answered · {acceptable} correct · {incorrect} missed
          </span>
        </div>
        <div className="progress-track" aria-label="Answered progress">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <article className="question-card">
        <div className="question-card-top">
          <span className="chip">{getChapterDisplayName(chapters, question.chapterId)}</span>
          <span className="chip chip-soft">{formatType(question.type)}</span>
          <span className={`chip chip-${difficulty}`}>{difficulty}</span>
          {question.status === 'unrated' ? <span className="chip chip-medium">Unrated</span> : null}
          {question.warning?.active ? <span className="chip chip-hard">{question.warning.label ?? 'Under review'}</span> : null}
          {progress.selfGrade ? <span className={`chip ${progress.selfGrade === 'acceptable' ? 'chip-easy' : 'chip-hard'}`}>{formatSelfGrade(progress.selfGrade)}</span> : null}
        </div>

        <h3>{question.question}</h3>

        <div className="question-meta">
          {teacherRatingCount > 0 ? <span>{teacherRatingCount} teacher ratings</span> : null}
          {studentRatingCount > 0 ? <span>{studentRatingCount} student ratings</span> : null}
        </div>

        {question.options?.length ? (
          <ol className="option-list">
            {question.options.map((option) => (
              <li key={option}>{option}</li>
            ))}
          </ol>
        ) : null}

        {question.answer && !progress.revealed ? (
          <button type="button" className="card-action-button card-action-button-primary" onClick={() => onReveal(question.id)}>
            Reveal Answer
          </button>
        ) : null}

        {question.answer && progress.revealed ? (
          <div className="answer-block answer-open">
            <span className="answer-label">Answer</span>
            <p>{question.answer}</p>
            {question.explanation ? <p className="answer-note">{question.explanation}</p> : null}
          </div>
        ) : null}

        {question.citations?.length ? (
          <div className="citation-list">
            <span className="answer-label">Citations</span>
            {question.citations.map((citation, citationIndex) => (
              <p key={`${citation.chapterId ?? citation.referenceId ?? citation.bookId ?? citation.sourceType}-${citationIndex}`} className="answer-note">
                {formatCitation(citation, chapters, references)}
                {citation.excerpt ? `: ${citation.excerpt}` : ''}
              </p>
            ))}
          </div>
        ) : null}

        {!question.answer ? <p className="muted-copy">No answer text was provided for this item.</p> : null}

        {progress.revealed && question.answer ? (
          <div className="self-assess-row">
            <button type="button" className="card-action-button card-action-button-good" onClick={() => onGrade(question.id, 'acceptable')}>
              Correct
            </button>
            <button type="button" className="card-action-button card-action-button-bad" onClick={() => onGrade(question.id, 'incorrect')}>
              Missed
            </button>
          </div>
        ) : null}

        <PublicReviewSummary question={question} />
      </article>

      <div className="question-nav">
        <button type="button" className="nav-button" disabled={index === 0} onClick={() => onNavigate(Math.max(0, index - 1))}>
          Previous
        </button>
        <span className="question-position">
          {index + 1} / {total}
        </span>
        <button type="button" className="nav-button nav-button-primary" onClick={() => (index === total - 1 ? onComplete() : onNavigate(index + 1))}>
          {index === total - 1 ? 'Complete' : 'Next'}
        </button>
      </div>
    </>
  )
}

function PublicReviewSummary({ question }: { question: StudyQuestion }) {
  const comments = question.comments ?? []
  const suggestions = question.suggestions ?? []

  if (comments.length === 0 && suggestions.length === 0) {
    return null
  }

  return (
    <div className="public-review-summary">
      {comments.length > 0 ? (
        <section>
          <span className="answer-label">Approved Comments</span>
          {comments.map((comment) => (
            <p key={comment.id} className="answer-note">
              {comment.comment}
            </p>
          ))}
        </section>
      ) : null}

      {suggestions.length > 0 ? (
        <section>
          <span className="answer-label">Suggested Updates</span>
          {suggestions.map((suggestion) => (
            <p key={suggestion.id} className="answer-note">
              {suggestion.summary}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  )
}

function ReferencesPanel({ references }: { references: StudyPayload['references'] }) {
  const safeReferences = references ?? []

  return (
    <section className="panel references-panel">
      <div className="panel-heading">
        <h2>References</h2>
        <span className="muted-chip">
          {safeReferences.length} link{safeReferences.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="reference-list">
        {safeReferences.length > 0 ? (
          safeReferences.map((reference) => {
            const card = (
              <>
              <div className="reference-card-top">
                <strong>{reference.title}</strong>
                <span className="reference-tag">{reference.importance}</span>
              </div>
              <div className="reference-card-tags">
                <span>{formatType(reference.resourceType)}</span>
                <span>{reference.scope}</span>
              </div>
              <p>{reference.description ?? 'Open reference'}</p>
              {reference.href ? <div className="reference-open">Open link</div> : null}
              </>
            )

            return reference.href ? (
              <a key={reference.id} className="reference-card" href={reference.href} target="_blank" rel="noreferrer">
                {card}
              </a>
            ) : (
              <article key={reference.id} className="reference-card">
                {card}
              </article>
            )
          })
        ) : (
          <p className="muted-copy">No references defined for this grade yet.</p>
        )}
      </div>
    </section>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<StudyPage />} />
    </Routes>
  )
}
