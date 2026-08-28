/*
  EduInSight — TypeScript type definitions

  These interfaces mirror the database schema defined in
  supabase/migrations/001_initial_schema.sql.
  They will be extended as each stage adds real queries.
*/

// ---------------------------------------------------------------------------
// Enums (as string literal unions for type safety)
// ---------------------------------------------------------------------------

export type UserRole = 'student' | 'teacher' | 'admin'

export type FeedbackStatus =
  | 'submitted'
  | 'analysed'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolved'

export type ActionStatus =
  | 'planned'
  | 'assigned'
  | 'in_progress'
  | 'completed'

export type ActionType = 'teaching' | 'institutional'

export type PriorityLevel = 'high' | 'medium' | 'low'

export type TrendDirection = 'increasing' | 'stable' | 'improving'

export type Sentiment = 'negative' | 'neutral' | 'positive'

export type IssueType =
  | 'learning_difficulty'
  | 'problem'
  | 'suggestion'
  | 'positive'
  | 'support_request'

export type DetectedLanguage = 'en' | 'ur' | 'roman_ur' | 'mixed'

export type ReviewStatus = 'pending' | 'reviewed' | 'rejected'

export type DepartmentType = 'academic' | 'administrative' | 'service'

export type StudyStructure = 'semester' | 'year'

export type ClusterStatus = 'open' | 'acknowledged' | 'action_created' | 'closed'

// ---------------------------------------------------------------------------
// Database row interfaces
// ---------------------------------------------------------------------------

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  institution_id: string
  department_id: string | null
  programme: string | null
  study_structure: StudyStructure | null
  study_stage: string | null
  avatar_initials: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Institution {
  id: string
  name: string
  email_domains: string[]
  is_active: boolean
  created_at: string
}

export interface Department {
  id: string
  name: string
  type: DepartmentType
  institution_id: string
  created_at: string
}

export interface Course {
  id: string
  name: string
  code: string | null
  department_id: string
  typical_stage: string | null
  is_active: boolean
  created_at: string
}

export interface CourseSection {
  id: string
  course_id: string
  section_name: string
  semester: string
  created_at: string
}

export interface TeacherAssignment {
  id: string
  teacher_id: string
  course_section_id: string
  created_at: string
}

export interface Feedback {
  id: string
  student_id: string
  institution_id: string
  department_id: string
  programme: string
  study_structure: StudyStructure
  study_stage: string
  university_service: string
  course_id: string | null
  course_section_id: string | null
  custom_course_name: string | null
  feedback_area: string
  feedback_types: string[]
  topic: string | null
  original_text: string
  language_detected: DetectedLanguage | null
  is_anonymous: boolean
  is_sensitive: boolean
  status: FeedbackStatus
  reference_number: string
  submitted_at: string
  analysed_at: string | null
}

export interface ExtractedIssue {
  id: string
  feedback_id: string
  issue_type: IssueType
  problem_description: string
  topic: string | null
  sentiment: Sentiment
  semantic_tag: string
  suggested_category: string | null
  ai_confidence: number | null
  review_status: ReviewStatus
  created_at: string
}

export interface IssueCluster {
  id: string
  title: string
  summary: string
  canonical_tag: string
  course_id: string | null
  department_id: string | null
  university_service: string | null
  feedback_area: string | null
  report_count: number
  feedback_share: number | null
  sentiment_primary: Sentiment | null
  trend: TrendDirection
  priority_level: PriorityLevel
  priority_score: number | null
  priority_factors: PriorityFactors | null
  ai_suggested_response: string | null
  ai_suggested_department: string | null
  is_sensitive: boolean
  status: ClusterStatus
  created_at: string
  updated_at: string
}

export interface ClusterFeedback {
  cluster_id: string
  feedback_id: string
  extracted_issue_id: string
}

export interface ClusterTagSynonym {
  id: string
  canonical_tag: string
  synonyms: string[]
  created_at: string
}

export interface Action {
  id: string
  cluster_id: string
  action_type: ActionType
  title: string
  status: ActionStatus
  created_by: string
  responsible_department: string | null
  responsible_person: string | null
  deadline: string | null
  internal_note: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ActionUpdate {
  id: string
  action_id: string
  student_facing_message: string
  is_published: boolean
  published_by: string | null
  published_at: string | null
  created_at: string
}

/** Student-safe row exposed by the published_action_updates view. */
export interface PublishedActionUpdate {
  id: string
  action_id: string
  student_facing_message: string
  published_at: string | null
  cluster_id: string
  action_type: ActionType
  action_title: string
  action_status: ActionStatus
  feedback_id: string
}

/** Row shape of the feedback_for_teacher security_barrier view. */
export interface TeacherFeedbackRow {
  id: string
  department_id: string
  programme: string
  study_structure: string
  study_stage: string
  university_service: string
  course_id: string | null
  course_section_id: string | null
  custom_course_name: string | null
  feedback_area: string
  feedback_types: string[]
  topic: string | null
  original_text: string
  language_detected: DetectedLanguage | null
  is_anonymous: boolean
  status: FeedbackStatus
  reference_number: string
  submitted_at: string
  analysed_at: string | null
}

/** Row shape of the extracted_issues_for_teacher view. */
export interface TeacherExtractedIssueRow {
  id: string
  feedback_id: string
  issue_type: IssueType
  problem_description: string
  topic: string | null
  sentiment: Sentiment
  semantic_tag: string
  suggested_category: string | null
  ai_confidence: number | null
  review_status: ReviewStatus
  created_at: string
}

/** Row shape of the clusters_for_teacher view. */
export type TeacherClusterRow = IssueCluster

/** Row returned by the teacher_read_my_actions RPC. */
export interface TeacherActionRow {
  id: string
  cluster_id: string
  action_type: string
  title: string
  status: string
  responsible_department: string | null
  responsible_person: string | null
  deadline: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Priority calculation types
// ---------------------------------------------------------------------------

export interface PriorityFactorDetail {
  score: number
  weight: number
  [key: string]: unknown
}

export interface PriorityFactors {
  frequency: PriorityFactorDetail & { count: number }
  impact: PriorityFactorDetail & { area: string }
  urgency: PriorityFactorDetail & { type: string }
  trend: PriorityFactorDetail & { direction: TrendDirection }
}

export interface PriorityResult {
  level: PriorityLevel
  score: number
  factors: PriorityFactors
}

// ---------------------------------------------------------------------------
// Supabase generated database type (minimal placeholder)
// This will be replaced by supabase gen types output in a future stage.
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      institutions: { Row: Institution; Insert: Omit<Institution, 'id' | 'created_at'>; Update: Partial<Institution> }
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Profile> }
      departments: { Row: Department; Insert: Omit<Department, 'id' | 'created_at'>; Update: Partial<Department> }
      courses: { Row: Course; Insert: Omit<Course, 'id' | 'created_at'>; Update: Partial<Course> }
      course_sections: { Row: CourseSection; Insert: Omit<CourseSection, 'id' | 'created_at'>; Update: Partial<CourseSection> }
      teacher_assignments: { Row: TeacherAssignment; Insert: Omit<TeacherAssignment, 'id' | 'created_at'>; Update: Partial<TeacherAssignment> }
      feedback: { Row: Feedback; Insert: Omit<Feedback, 'id' | 'submitted_at' | 'analysed_at'>; Update: Partial<Feedback> }
      extracted_issues: { Row: ExtractedIssue; Insert: Omit<ExtractedIssue, 'id' | 'created_at'>; Update: Partial<ExtractedIssue> }
      issue_clusters: { Row: IssueCluster; Insert: Omit<IssueCluster, 'id' | 'created_at' | 'updated_at'>; Update: Partial<IssueCluster> }
      cluster_feedback: { Row: ClusterFeedback; Insert: ClusterFeedback; Update: never }
      cluster_tag_synonyms: { Row: ClusterTagSynonym; Insert: Omit<ClusterTagSynonym, 'id' | 'created_at'>; Update: Partial<ClusterTagSynonym> }
      actions: { Row: Action; Insert: Omit<Action, 'id' | 'created_at' | 'updated_at' | 'completed_at'>; Update: Partial<Action> }
      action_updates: { Row: ActionUpdate; Insert: Omit<ActionUpdate, 'id' | 'created_at'>; Update: Partial<ActionUpdate> }
    }
    Views: {
      my_feedback: { Row: Feedback }
      published_action_updates: { Row: PublishedActionUpdate }
      feedback_for_teacher: { Row: TeacherFeedbackRow }
      extracted_issues_for_teacher: { Row: TeacherExtractedIssueRow }
      clusters_for_teacher: { Row: TeacherClusterRow }
    }
    Functions: {
      submit_feedback: {
        Args: {
          p_department_id: string
          p_programme: string
          p_study_structure: string
          p_study_stage: string
          p_university_service: string
          p_course_id?: string | null
          p_course_section_id?: string | null
          p_custom_course_name?: string | null
          p_feedback_area?: string
          p_feedback_types?: string[]
          p_topic?: string | null
          p_original_text?: string
          p_is_anonymous?: boolean
        }
        Returns: { id: string; reference_number: string }[]
      }
      teacher_acknowledge_cluster: {
        Args: { p_cluster_id?: string }
        Returns: IssueCluster[]
      }
      teacher_read_my_actions: {
        Args: Record<string, never>
        Returns: TeacherActionRow[]
      }
      teacher_create_action: {
        Args: {
          p_cluster_id?: string
          p_title?: string
          p_responsible_department?: string | null
          p_responsible_person?: string | null
          p_deadline?: string | null
        }
        Returns: TeacherActionRow[]
      }
      teacher_update_my_action: {
        Args: {
          p_action_id?: string
          p_title?: string | null
          p_status?: string | null
          p_responsible_department?: string | null
          p_responsible_person?: string | null
          p_deadline?: string | null
        }
        Returns: TeacherActionRow[]
      }
      teacher_publish_update: {
        Args: {
          p_action_id?: string
          p_student_facing_message?: string
        }
        Returns: string
      }
      teacher_read_my_updates: {
        Args: Record<string, never>
        Returns: ActionUpdate[]
      }
      admin_create_action: {
        Args: {
          p_cluster_id?: string
          p_title?: string
          p_status?: string | null
          p_responsible_department?: string | null
          p_responsible_person?: string | null
          p_deadline?: string | null
          p_internal_note?: string | null
          p_student_facing_message?: string | null
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}
