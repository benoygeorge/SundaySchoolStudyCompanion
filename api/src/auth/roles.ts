import type { AuthUserContext, StudyRole } from '../../../shared/studyContracts.js'

type ExamUser = {
  id?: number | string
  user_id?: number | string
  username?: string
  user_type?: string
  school_id?: number | string | null
  school_name?: string | null
  grade?: string | number | null
  email_verified?: boolean
}

export function mapRole(userType: unknown): StudyRole | null {
  const role = String(userType || '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')

  if (role === 'admin') {
    return 'Admin'
  }

  if (role === 'school-admin') {
    return 'Teacher'
  }

  if (role === 'student') {
    return 'Student'
  }

  return null
}

export function mapExamUserToAuthContext(user: ExamUser): AuthUserContext | null {
  const role = mapRole(user.user_type)

  if (!role) {
    return null
  }

  const sourceId = user.user_id ?? user.username ?? user.id

  if (sourceId === undefined || sourceId === null || sourceId === '') {
    return null
  }

  const schoolId = user.school_id === undefined || user.school_id === null ? null : Number(user.school_id)

  return {
    id: String(sourceId),
    role,
    sourceRole: String(user.user_type),
    schoolId: Number.isFinite(schoolId) ? schoolId : null,
    schoolName: user.school_name ?? null,
    grade: user.grade === undefined || user.grade === null ? null : String(user.grade),
    emailVerified: user.email_verified
  }
}
