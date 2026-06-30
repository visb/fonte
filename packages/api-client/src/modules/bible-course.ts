import type { AxiosInstance } from 'axios';
import type {
  BibleCourseClass,
  BibleCourseClassDetail,
  BibleCourseEnrollment,
  CreateBibleCourseClassInput,
  UpdateBibleCourseClassInput,
  EnrollResidentInput,
  UpdateBibleCourseEnrollmentInput,
  BibleCourseModule,
  CreateBibleCourseModuleInput,
  UpdateBibleCourseModuleInput,
  BibleClassGrades,
  UpsertBibleGradeInput,
  BibleCourseClassPhoto,
} from '../types.js';

export function createBibleCourseModule(http: AxiosInstance) {
  return {
    listModules: () =>
      http.get<BibleCourseModule[]>('/bible-course/modules').then((r) => r.data),
    createModule: (data: CreateBibleCourseModuleInput) =>
      http.post<BibleCourseModule>('/bible-course/modules', data).then((r) => r.data),
    updateModule: (id: string, data: UpdateBibleCourseModuleInput) =>
      http.patch<BibleCourseModule>(`/bible-course/modules/${id}`, data).then((r) => r.data),
    deleteModule: (id: string) => http.delete(`/bible-course/modules/${id}`),

    listClasses: (status?: string) =>
      http
        .get<BibleCourseClass[]>('/bible-course/classes', { params: status ? { status } : undefined })
        .then((r) => r.data),
    createClass: (data: CreateBibleCourseClassInput) =>
      http.post<BibleCourseClass>('/bible-course/classes', data).then((r) => r.data),
    getClass: (id: string) =>
      http.get<BibleCourseClassDetail>(`/bible-course/classes/${id}`).then((r) => r.data),
    updateClass: (id: string, data: UpdateBibleCourseClassInput) =>
      http.patch<BibleCourseClass>(`/bible-course/classes/${id}`, data).then((r) => r.data),
    deleteClass: (id: string) => http.delete(`/bible-course/classes/${id}`),

    enroll: (classId: string, data: EnrollResidentInput) =>
      http.post<BibleCourseEnrollment>(`/bible-course/classes/${classId}/enrollments`, data).then((r) => r.data),
    updateEnrollment: (id: string, data: UpdateBibleCourseEnrollmentInput) =>
      http.patch<BibleCourseEnrollment>(`/bible-course/enrollments/${id}`, data).then((r) => r.data),
    removeEnrollment: (id: string) => http.delete(`/bible-course/enrollments/${id}`),

    getClassGrades: (classId: string) =>
      http.get<BibleClassGrades>(`/bible-course/classes/${classId}/grades`).then((r) => r.data),
    upsertGrade: (enrollmentId: string, moduleId: string, data: UpsertBibleGradeInput) =>
      http
        .put<unknown>(`/bible-course/enrollments/${enrollmentId}/grades/${moduleId}`, data)
        .then((r) => r.data),

    // ── fotos por turma (story 92) ───────────────────────────────────────────
    listClassPhotos: (classId: string) =>
      http
        .get<BibleCourseClassPhoto[]>(`/bible-course/classes/${classId}/photos`)
        .then((r) => r.data),

    /** Sobe uma foto à turma. Recebe FormData com o campo `file`. */
    uploadClassPhoto: (classId: string, formData: FormData) =>
      http
        .post<BibleCourseClassPhoto>(`/bible-course/classes/${classId}/photos`, formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),

    deleteClassPhoto: (classId: string, photoId: string) =>
      http.delete(`/bible-course/classes/${classId}/photos/${photoId}`).then((r) => r.data),
  };
}
