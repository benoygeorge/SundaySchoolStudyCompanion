import { z } from 'zod'

export const apiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
    trace_id: z.string().optional()
  })

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  trace_id: z.string().optional()
})

export const studyRoleSchema = z.enum(['Student', 'Teacher', 'Admin'])

export const authUserContextSchema = z.object({
  id: z.string().min(1),
  role: studyRoleSchema,
  sourceRole: z.string().min(1),
  schoolId: z.number().nullable().optional(),
  schoolName: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  emailVerified: z.boolean().optional()
})

export const authSessionSchema = z.object({
  expiresAt: z.string(),
  csrfToken: z.string().min(1),
  sessionToken: z.string().min(1).optional(),
  authToken: z.string().min(1).optional()
})

export const loginRequestSchema = z.object({
  user_id: z.string().min(1),
  password: z.string().min(1),
  recaptcha_token: z.string().optional()
})

export const loginResponseDataSchema = z.object({
  session: authSessionSchema,
  user: authUserContextSchema
})

export const authMeDataSchema = z.object({
  user: authUserContextSchema
})

export const gradeIndexEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  file: z.string().optional(),
  description: z.string().optional()
})

export const gradeListSchema = z.object({
  grades: z.array(gradeIndexEntrySchema)
})

export const chapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  bookId: z.string().min(1),
  sectionId: z.string().optional()
})

export const curriculumBookRoleSchema = z.enum(['primary', 'supplemental'])

export const curriculumBookSchema = z.object({
  id: z.string().min(1),
  role: curriculumBookRoleSchema,
  title: z.string().min(1),
  edition: z.string().optional(),
  issuedAt: z.string().optional()
})

export const curriculumSectionSchema = z.object({
  id: z.string().min(1),
  bookId: z.string().min(1),
  title: z.string().min(1)
})

export const ratingSummarySchema = z.object({
  count: z.number().nonnegative().default(0),
  correctness: z.number().optional(),
  clarity: z.number().optional(),
  difficulty: z.number().optional(),
  usefulness: z.number().optional()
})

export const questionRatingsSchema = z.object({
  teacher: ratingSummarySchema.optional(),
  student: ratingSummarySchema.optional()
})

export const publicCommentSchema = z.object({
  id: z.string(),
  roleGroup: z.string().optional(),
  comment: z.string(),
  createdAt: z.string().optional()
})

export const publicSuggestionSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  summary: z.string(),
  createdAt: z.string().optional()
})

export const citationPageSchema = z.union([z.string(), z.number()])

export const questionCitationSourceTypeSchema = z.enum(['book', 'reference', 'teacher_note', 'external', 'other'])

export const questionCitationSchema = z.object({
  id: z.string().optional(),
  sourceType: questionCitationSourceTypeSchema.default('book'),
  bookId: z.string().optional(),
  chapterId: z.string().optional(),
  referenceId: z.string().optional(),
  page: citationPageSchema.optional(),
  pageEnd: citationPageSchema.optional(),
  excerpt: z.string().nullable().optional(),
  status: z.string().optional()
})

export const questionWarningSchema = z.object({
  active: z.boolean(),
  label: z.string().nullable().optional()
})

export const studyQuestionSchema = z.object({
  id: z.string().min(1),
  chapterId: z.string().min(1),
  type: z.string().min(1),
  difficulty: z.string().nullable().optional(),
  status: z.string().optional(),
  question: z.string().min(1),
  options: z.array(z.string()).nullable().optional(),
  answer: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  citations: z.array(questionCitationSchema).optional(),
  warning: questionWarningSchema.optional(),
  ratings: questionRatingsSchema.optional(),
  comments: z.array(publicCommentSchema).optional(),
  suggestions: z.array(publicSuggestionSchema).optional()
})

export const referenceResourceTypeSchema = z.enum(['website', 'study_guide', 'teacher_notes', 'document', 'video', 'liturgy_text', 'other'])
export const referenceImportanceSchema = z.enum(['required', 'recommended', 'optional'])
export const referenceScopeSchema = z.enum(['grade', 'book', 'section', 'chapter', 'general'])

export const studyReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  href: z.string().optional(),
  description: z.string().optional(),
  resourceType: referenceResourceTypeSchema.default('website'),
  importance: referenceImportanceSchema.default('recommended'),
  scope: referenceScopeSchema.default('grade'),
  bookId: z.string().optional(),
  sectionId: z.string().optional(),
  chapterId: z.string().optional()
})

export const studyPayloadSchema = z.object({
  grade: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  books: z.array(curriculumBookSchema).optional(),
  sections: z.array(curriculumSectionSchema).optional(),
  chapters: z.array(chapterSchema).optional(),
  questions: z.array(studyQuestionSchema),
  references: z.array(studyReferenceSchema).optional()
})

export const adminCurriculumSchema = z.object({
  gradeId: z.string().min(1),
  label: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  books: z.array(curriculumBookSchema).optional(),
  sections: z.array(curriculumSectionSchema).optional(),
  chapters: z.array(chapterSchema),
  referenceLinks: z.array(studyReferenceSchema),
  version: z.number().int().nonnegative().optional(),
  updatedAt: z.string().optional()
})

export const adminCurriculumInputSchema = z.object({
  label: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  reason: z.string().min(3),
  books: z.array(curriculumBookSchema).default([]),
  sections: z.array(curriculumSectionSchema).default([]),
  chapters: z.array(chapterSchema),
  referenceLinks: z.array(studyReferenceSchema)
})

export const adminQuestionStatusSchema = z.enum(['unrated', 'published', 'archived'])

export const adminQuestionWarningSchema = z.object({
  active: z.boolean(),
  label: z.string().nullable().optional(),
  reason: z.string().nullable().optional()
})

export const adminQuestionSchema = z.object({
  id: z.string().min(1),
  gradeId: z.string().min(1),
  status: adminQuestionStatusSchema,
  questionType: z.string().min(1),
  chapterId: z.string().min(1),
  difficulty: z.string().nullable().optional(),
  question: z.string().min(1),
  options: z.array(z.string()).nullable().optional(),
  answer: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  citations: z.array(questionCitationSchema).optional(),
  warning: adminQuestionWarningSchema.optional(),
  version: z.number().int().nonnegative().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export const adminQuestionInputSchema = z.object({
  reason: z.string().min(3),
  status: adminQuestionStatusSchema.default('unrated'),
  questionType: z.string().min(1),
  chapterId: z.string().min(1),
  difficulty: z.string().nullable().optional(),
  question: z.string().min(1),
  options: z.array(z.string()).nullable().optional(),
  answer: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
  citations: z.array(questionCitationSchema).optional(),
  warning: adminQuestionWarningSchema.optional()
})

export const adminQuestionListSchema = z.object({
  questions: z.array(adminQuestionSchema)
})

export const gradeListResponseSchema = apiSuccessSchema(gradeListSchema)
export const studyPayloadResponseSchema = apiSuccessSchema(studyPayloadSchema)
export const loginResponseSchema = apiSuccessSchema(loginResponseDataSchema)
export const authMeResponseSchema = apiSuccessSchema(authMeDataSchema)
export const adminCurriculumResponseSchema = apiSuccessSchema(adminCurriculumSchema)
export const adminQuestionResponseSchema = apiSuccessSchema(adminQuestionSchema)
export const adminQuestionListResponseSchema = apiSuccessSchema(adminQuestionListSchema)

export type ApiError = z.infer<typeof apiErrorSchema>
export type StudyRole = z.infer<typeof studyRoleSchema>
export type AuthUserContext = z.infer<typeof authUserContextSchema>
export type AuthSession = z.infer<typeof authSessionSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type LoginResponseData = z.infer<typeof loginResponseDataSchema>
export type GradeIndexEntry = z.infer<typeof gradeIndexEntrySchema>
export type GradeList = z.infer<typeof gradeListSchema>
export type Chapter = z.infer<typeof chapterSchema>
export type CurriculumBook = z.infer<typeof curriculumBookSchema>
export type CurriculumSection = z.infer<typeof curriculumSectionSchema>
export type StudyQuestion = z.infer<typeof studyQuestionSchema>
export type StudyReference = z.infer<typeof studyReferenceSchema>
export type QuestionCitation = z.infer<typeof questionCitationSchema>
export type StudyPayload = z.infer<typeof studyPayloadSchema>
export type AdminCurriculum = z.infer<typeof adminCurriculumSchema>
export type AdminCurriculumInput = z.infer<typeof adminCurriculumInputSchema>
export type AdminQuestion = z.infer<typeof adminQuestionSchema>
export type AdminQuestionInput = z.infer<typeof adminQuestionInputSchema>
