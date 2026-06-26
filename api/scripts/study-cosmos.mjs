import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CosmosClient } from '@azure/cosmos'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const envFile = join(repoRoot, '.env')
const gradeIndexFile = join(repoRoot, 'public', 'data', 'grade-index.json')
const canonicalStudyContainers = new Set(['study-content', 'study-ratings', 'study-comments'])

function loadEnv() {
  if (!existsSync(envFile)) {
    return
  }

  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')

    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '')
    process.env[key] ??= value
  }
}

function getSetting(names) {
  for (const name of names) {
    const value = process.env[name]
    if (value) {
      return value
    }
  }

  throw new Error(`Missing setting: ${names.join(' or ')}`)
}

function getClient() {
  loadEnv()
  return new CosmosClient({
    endpoint: getSetting(['COSMOS_ENDPOINT', 'cosmos-db-endpoint']),
    key: getSetting(['COSMOS_KEY', 'cosmos-db-key'])
  })
}

function getDatabase(client) {
  return client.database(getSetting(['COSMOS_DATABASE_ID', 'cosmos-db-database']))
}

async function ensureContainers(database) {
  const definitions = [
    { id: 'study-content', partitionKey: { paths: ['/gradeId'] } },
    { id: 'study-ratings', partitionKey: { paths: ['/questionId'] } },
    { id: 'study-comments', partitionKey: { paths: ['/gradeId'] } }
  ]

  const containers = {}

  for (const definition of definitions) {
    const { container } = await database.containers.createIfNotExists(definition)
    containers[definition.id] = container
  }

  return containers
}

function normalizeId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function makeQuestionId(gradeId, sourceId) {
  return `q_${normalizeId(gradeId)}_${normalizeId(sourceId)}`
}

function makeReferenceId(title, index) {
  return `ref_${normalizeId(title || `reference_${index + 1}`)}`
}

function utcNow() {
  return new Date().toISOString()
}

function stripCosmosMetadata(document) {
  const metadataKeys = new Set(['_rid', '_self', '_etag', '_attachments', '_ts'])
  return Object.fromEntries(Object.entries(document).filter(([key]) => !metadataKeys.has(key)))
}

function loadGradeIndex() {
  return JSON.parse(readFileSync(gradeIndexFile, 'utf8')).grades ?? []
}

function gradeFilePath(entry) {
  const relativeFile = (entry.file ?? `/data/grades/${entry.id}.json`).replace(/^\/?data\//, '')
  return join(repoRoot, 'public', 'data', relativeFile)
}

function gradeSourceFile(entry) {
  return `public/data/${(entry.file ?? `/data/grades/${entry.id}.json`).replace(/^\/?data\//, '')}`
}

function loadGradeJson(entry) {
  return JSON.parse(readFileSync(gradeFilePath(entry), 'utf8'))
}

function loadGradeById(gradeId) {
  const entry = loadGradeIndex().find((grade) => grade.id === gradeId)

  if (!entry) {
    throw new Error(`Grade ${gradeId} not found in grade-index.json`)
  }

  return {
    entry,
    data: loadGradeJson(entry)
  }
}

function buildCurriculum(gradeId, gradeData, now, sourceFile) {
  return {
    id: `${gradeId}-curriculum`,
    docType: 'curriculum',
    gradeId,
    label: gradeData.grade,
    title: gradeData.title,
    description: gradeData.description,
    books: gradeData.books ?? [],
    sections: gradeData.sections ?? [],
    chapters: gradeData.chapters ?? [],
    referenceLinks: normalizeReferences(gradeData.references ?? []),
    source: {
      type: 'static-json',
      file: sourceFile
    },
    createdAt: now,
    updatedAt: now
  }
}

function normalizeReferences(references) {
  return references.map((reference, index) => ({
    id: reference.id ?? makeReferenceId(reference.title, index),
    title: reference.title,
    ...(reference.href ? { href: reference.href } : {}),
    ...(reference.description ? { description: reference.description } : {}),
    resourceType: reference.resourceType ?? 'website',
    importance: reference.importance ?? 'recommended',
    scope: reference.scope ?? 'grade',
    ...(reference.bookId ? { bookId: reference.bookId } : {}),
    ...(reference.sectionId ? { sectionId: reference.sectionId } : {}),
    ...(reference.chapterId ? { chapterId: reference.chapterId } : {})
  }))
}

function normalizeCurrentCitation(citation, questionId, index) {
  return {
    id: citation?.id ?? `cit_${questionId}_${index + 1}`,
    sourceType: citation?.sourceType ?? 'book',
    ...(citation?.bookId ? { bookId: citation.bookId } : {}),
    ...(citation?.chapterId ? { chapterId: citation.chapterId } : {}),
    ...(citation?.referenceId ? { referenceId: citation.referenceId } : {}),
    ...(citation?.page ? { page: citation.page } : {}),
    ...(citation?.pageEnd ? { pageEnd: citation.pageEnd } : {}),
    ...(citation?.excerpt ? { excerpt: citation.excerpt } : {}),
    ...(citation?.status ? { status: citation.status } : { status: 'approved' })
  }
}

function normalizeMigratedCitation(citation, fallbackQuestion) {
  const details = citation?.details ?? {}
  const chapterId = citation?.chapterId ?? details.chapter ?? fallbackQuestion?.chapterId ?? fallbackQuestion?.chapter
  const page = citation?.page ?? details.page ?? fallbackQuestion?.page
  const pageEnd = citation?.pageEnd ?? details.pageEnd
  const excerpt = citation?.excerpt ?? citation?.sourceExcerpt ?? fallbackQuestion?.source_excerpt

  return {
    ...(citation?.id ? { id: citation.id } : {}),
    sourceType: citation?.sourceType ?? (citation?.citationType === 'teacher_note' ? 'teacher_note' : 'book'),
    ...(citation?.bookId || details.bookId ? { bookId: citation?.bookId ?? details.bookId } : {}),
    ...(chapterId ? { chapterId: String(chapterId) } : {}),
    ...(citation?.referenceId ? { referenceId: citation.referenceId } : {}),
    ...(page ? { page } : {}),
    ...(pageEnd ? { pageEnd } : {}),
    ...(excerpt ? { excerpt } : {}),
    ...(citation?.status ? { status: citation.status } : { status: 'approved' })
  }
}

function buildQuestionCitations(sourceQuestion, questionId) {
  if (!Array.isArray(sourceQuestion.citations) || sourceQuestion.citations.length === 0) {
    return []
  }

  return sourceQuestion.citations.map((citation, index) => normalizeCurrentCitation(citation, questionId, index))
}

function buildMigratedQuestionCitations(question, questionId) {
  if (!question.source_excerpt && !question.page) {
    return []
  }

  return [
    {
      id: `cit_${questionId}_source`,
      sourceType: question.source_excerpt ? 'teacher_note' : 'book',
      chapterId: String(question.chapterId),
      ...(question.page ? { page: question.page } : {}),
      ...(question.source_excerpt ? { excerpt: question.source_excerpt } : {}),
      status: 'approved'
    }
  ]
}

function buildQuestion(gradeId, sourceQuestion, now) {
  const questionId = makeQuestionId(gradeId, sourceQuestion.id)
  return {
    id: questionId,
    docType: 'question',
    gradeId,
    sourceQuestionId: sourceQuestion.id,
    status: 'unrated',
    questionType: sourceQuestion.type,
    chapterId: String(sourceQuestion.chapterId),
    difficulty: sourceQuestion.difficulty ?? null,
    question: sourceQuestion.question,
    options: sourceQuestion.options ?? null,
    answer: sourceQuestion.answer ?? null,
    explanation: sourceQuestion.explanation ?? null,
    citations: buildQuestionCitations(sourceQuestion, questionId),
    warning: {
      active: false,
      label: null,
      reason: null,
      resolvedAt: null
    },
    version: 1,
    createdBy: {
      authProvider: 'system',
      userId: null,
      roleAtCreation: 'system'
    },
    createdAt: now,
    updatedAt: now
  }
}

function buildSupplementalDocs(gradeId, questionId, now) {
  const ratingSummary = {
    id: `rating_summary_${questionId}`,
    docType: 'ratingSummary',
    questionId,
    gradeId,
    teacher: {
      count: 0,
      correctnessSum: 0,
      claritySum: 0,
      difficultySum: 0,
      usefulnessSum: 0
    },
    student: {
      count: 0,
      correctnessSum: 0,
      claritySum: 0,
      difficultySum: 0,
      usefulnessSum: 0
    },
    updatedAt: now
  }

  const comment = {
    id: `comment_seed_${questionId}`,
    docType: 'comment',
    gradeId,
    questionId,
    ratingId: null,
    status: 'approved',
    visibility: 'public_after_review',
    roleGroup: 'teacher',
    comment: 'Seeded public comment for workflow verification.',
    submittedBy: {
      authProvider: 'system',
      userId: 'seed',
      roleAtSubmission: 'Teacher',
      schoolId: null
    },
    reviews: [],
    teacherApprovalCount: 2,
    teacherRejectionCount: 0,
    createdAt: now,
    updatedAt: now
  }

  const suggestion = {
    id: `sugg_seed_${questionId}`,
    docType: 'suggestion',
    gradeId,
    questionId,
    type: 'edit',
    status: 'pending_review',
    summary: 'Seeded wording review item',
    baseQuestionVersion: 1,
    patchHash: 'sha256:seeded-review-item',
    patch: [
      {
        op: 'add',
        path: '/explanation',
        value: 'Seeded explanation review item.'
      }
    ],
    submittedBy: {
      authProvider: 'system',
      userId: 'seed',
      roleAtSubmission: 'Teacher',
      schoolId: null
    },
    reviews: [],
    approvalCount: 0,
    rejectionCount: 0,
    idempotencyKey: `sugg_seed_${questionId}:v1`,
    createdAt: now,
    updatedAt: now
  }

  const flag = {
    id: `flag_seed_${questionId}`,
    docType: 'flag',
    gradeId,
    questionId,
    flagType: 'other',
    message: 'Seeded resolved flag for workflow verification.',
    status: 'resolved',
    submittedBy: {
      authProvider: 'system',
      userId: 'seed',
      roleAtSubmission: 'Teacher',
      schoolId: null
    },
    resolution: 'no_action_needed',
    reviewNote: 'Seeded verification flag; no content action needed.',
    resolvedAt: now,
    createdAt: now
  }

  const contentAudit = {
    id: `audit_seed_content_${questionId}`,
    docType: 'auditLog',
    gradeId,
    entityType: 'question',
    entityId: questionId,
    action: 'seeded_from_static_json',
    actorRole: 'system',
    actor: {
      authProvider: 'system',
      userId: null,
      roleAtAction: 'system'
    },
    summary: 'Question seeded from static JSON source.',
    details: {
      questionId
    },
    createdAt: now
  }

  const commentAudit = {
    id: `audit_seed_comment_${questionId}`,
    docType: 'auditLog',
    gradeId,
    entityType: 'comment',
    entityId: comment.id,
    action: 'seeded_comment',
    actorRole: 'system',
    actor: {
      authProvider: 'system',
      userId: null,
      roleAtAction: 'system'
    },
    summary: 'Seed comment created for workflow verification.',
    details: {
      questionId
    },
    createdAt: now
  }

  const userRoleContext = {
    id: `userctx_${gradeId}_system_seed`,
    docType: 'userRoleContext',
    gradeId,
    authProvider: 'system',
    userId: 'seed',
    role: 'Teacher',
    sourceRole: 'school-admin',
    schoolId: null,
    schoolName: null,
    sourceGrade: '10',
    lastSeenAt: now,
    updatedAt: now
  }

  return {
    ratingSummary,
    comment,
    suggestion,
    flag,
    contentAudit,
    commentAudit,
    userRoleContext
  }
}

async function upsert(container, item, partitionKey) {
  await container.items.upsert(item, { partitionKey })
}

function isStudyContainer(containerId) {
  return containerId.startsWith('study-')
}

async function getContainerSummary(database, containerId) {
  const container = database.container(containerId)
  const [{ count = 0 } = {}] = await container.items
    .query({
      query: 'SELECT COUNT(1) AS count FROM c'
    })
    .fetchAll()
    .then((result) => result.resources)

  const { resources: docTypes } = await container.items
    .query({
      query: 'SELECT c.docType, COUNT(1) AS count FROM c GROUP BY c.docType'
    })
    .fetchAll()

  return {
    count,
    docTypes
  }
}

async function inspect() {
  const client = getClient()
  const database = getDatabase(client)
  const { resources: containers } = await database.containers.readAll().fetchAll()
  console.log('containers:', containers.map((container) => container.id).sort().join(', '))

  const studyContainers = containers.map((container) => container.id).filter(isStudyContainer).sort()

  for (const containerId of studyContainers) {
    const summary = await getContainerSummary(database, containerId)
    const status = canonicalStudyContainers.has(containerId) ? 'canonical' : 'prunable'
    console.log(`${containerId} (${status}):`, JSON.stringify(summary))
  }
}

async function pruneStudyContainers() {
  if (!process.argv.includes('--yes')) {
    throw new Error('Refusing to delete containers without --yes')
  }

  const client = getClient()
  const database = getDatabase(client)
  const { resources: containers } = await database.containers.readAll().fetchAll()
  const unwantedContainers = containers
    .map((container) => container.id)
    .filter((containerId) => isStudyContainer(containerId) && !canonicalStudyContainers.has(containerId))
    .sort()

  if (unwantedContainers.length === 0) {
    console.log('No prunable study containers found.')
    return
  }

  for (const containerId of unwantedContainers) {
    const summary = await getContainerSummary(database, containerId)
    console.log(`Deleting ${containerId}: ${summary.count} document(s)`)
    await database.container(containerId).delete()
  }
}

async function seed() {
  const client = getClient()
  const database = getDatabase(client)
  const containers = await ensureContainers(database)
  const gradeId = 'grade-10'
  const now = utcNow()
  const { entry, data: gradeData } = loadGradeById(gradeId)
  const questions = gradeData.questions.map((question) => buildQuestion(gradeId, question, now))

  await upsert(containers['study-content'], buildCurriculum(gradeId, gradeData, now, gradeSourceFile(entry)), gradeId)

  for (const question of questions) {
    await upsert(containers['study-content'], question, gradeId)
  }

  const firstQuestionId = questions[0].id
  const supplementalDocs = buildSupplementalDocs(gradeId, firstQuestionId, now)

  await upsert(containers['study-ratings'], supplementalDocs.ratingSummary, firstQuestionId)
  await upsert(containers['study-comments'], supplementalDocs.comment, gradeId)
  await upsert(containers['study-comments'], supplementalDocs.commentAudit, gradeId)
  await upsert(containers['study-content'], supplementalDocs.suggestion, gradeId)
  await upsert(containers['study-content'], supplementalDocs.flag, gradeId)
  await upsert(containers['study-content'], supplementalDocs.contentAudit, gradeId)
  await upsert(containers['study-content'], supplementalDocs.userRoleContext, gradeId)

  const typeCounts = questions.reduce((counts, question) => {
    counts[question.questionType] = (counts[question.questionType] ?? 0) + 1
    return counts
  }, {})

  console.log(
    JSON.stringify(
      {
        seededGradeId: gradeId,
        curriculum: 1,
        questions: questions.length,
        questionTypes: typeCounts,
        supplementalDocs: {
          ratingSummary: 1,
          comment: 1,
          suggestion: 1,
          flag: 1,
          contentAudit: 1,
          commentAudit: 1,
          userRoleContext: 1
        }
      },
      null,
      2
    )
  )
}

async function migrateCurriculumSchema() {
  const client = getClient()
  const database = getDatabase(client)
  const containers = await ensureContainers(database)
  const contentContainer = containers['study-content']
  const now = utcNow()
  const gradeEntries = loadGradeIndex()
  const results = []

  for (const entry of gradeEntries) {
    const gradeId = entry.id
    const gradeData = loadGradeJson(entry)
    const sourceQuestionsById = new Map((gradeData.questions ?? []).map((question) => [question.id, question]))
    const curriculumId = `${gradeId}-curriculum`

    let existingCurriculum = null
    try {
      const { resource } = await contentContainer.item(curriculumId, gradeId).read()
      existingCurriculum = resource ?? null
    } catch (error) {
      if (error?.code !== 404) {
        throw error
      }
    }

    const shouldPreserveExistingShell = existingCurriculum && (gradeData.questions ?? []).length === 0 && (gradeData.books ?? []).length === 0 && (gradeData.chapters ?? []).length === 0
    const curriculum = shouldPreserveExistingShell
      ? existingCurriculum
      : {
          ...buildCurriculum(gradeId, gradeData, now, gradeSourceFile(entry)),
          createdAt: existingCurriculum?.createdAt ?? now,
          version: (existingCurriculum?.version ?? 0) + 1,
          updatedAt: now
        }

    if (!shouldPreserveExistingShell) {
      await upsert(contentContainer, curriculum, gradeId)
    }

    const { resources: questions } = await contentContainer.items
      .query(
        {
          query: 'SELECT * FROM c WHERE c.docType = @docType AND c.gradeId = @gradeId',
          parameters: [
            { name: '@docType', value: 'question' },
            { name: '@gradeId', value: gradeId }
          ]
        },
        { partitionKey: gradeId }
      )
      .fetchAll()

    let migratedQuestions = 0
    for (const question of questions) {
      const sourceQuestion = sourceQuestionsById.get(question.sourceQuestionId)
      const chapterId = String(question.chapterId ?? sourceQuestion?.chapterId ?? question.chapter)
      const existingCitations = Array.isArray(question.citations) ? question.citations : []
      const citations =
        existingCitations.length > 0
          ? existingCitations.map((citation, index) => ({
              id: citation.id ?? `cit_${question.id}_${index + 1}`,
              ...normalizeMigratedCitation(citation, { ...question, chapterId })
            }))
          : sourceQuestion
            ? buildQuestionCitations(sourceQuestion, question.id)
            : buildMigratedQuestionCitations({ ...question, chapterId }, question.id)
      const {
        chapter: _chapter,
        section: _section,
        page: _page,
        source_excerpt: _sourceExcerpt,
        citations: _citations,
        ...currentQuestion
      } = stripCosmosMetadata(question)

      await upsert(
        contentContainer,
        {
          ...currentQuestion,
          chapterId,
          citations,
          updatedAt: now
        },
        gradeId
      )
      migratedQuestions += 1
    }

    results.push({
      gradeId,
      curriculumAction: shouldPreserveExistingShell ? 'preserved' : existingCurriculum ? 'updated' : 'created',
      curriculumSchema: {
        books: curriculum.books?.length ?? 0,
        sections: curriculum.sections?.length ?? 0,
        chapters: curriculum.chapters?.length ?? 0
      },
      migratedQuestionCitations: migratedQuestions
    })
  }

  console.log(
    JSON.stringify(
      {
        migratedGrades: results
      },
      null,
      2
    )
  )
}

const command = process.argv[2] ?? 'inspect'

if (command === 'inspect') {
  await inspect()
} else if (command === 'seed') {
  await seed()
} else if (command === 'migrate-curriculum-schema') {
  await migrateCurriculumSchema()
} else if (command === 'prune-study-containers') {
  await pruneStudyContainers()
} else {
  throw new Error(`Unknown command: ${command}`)
}
