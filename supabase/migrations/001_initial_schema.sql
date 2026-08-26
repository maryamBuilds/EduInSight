-- EduInSight — Initial database schema
-- Migration: 001_initial_schema.sql
-- Creates private schema, tables, constraints, indexes, helper functions,
-- triggers, and the auth signup hook.

-- ============================================================================
-- 0. PRIVATE SCHEMA
-- ============================================================================
-- Internal helpers live here so they are NOT exposed through the Supabase
-- Data API (PostgREST), which only serves objects in the public schema.

CREATE SCHEMA IF NOT EXISTS private;

-- Authenticated users need USAGE on the private schema because RLS policy
-- expressions reference private.get_user_role().  Without USAGE, PostgreSQL
-- raises "permission denied for schema private" during policy evaluation.
-- USAGE only allows name resolution; EXECUTE on individual functions is
-- controlled separately via REVOKE/GRANT on each function.
-- anon does NOT receive USAGE: unauthenticated requests never reach RLS
-- policies or views that call private helpers.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Departments (university departments and responsible units)
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  programme text,
  study_structure text,
  study_stage text,
  avatar_initials text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Courses
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  name text NOT NULL,
  code text,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  typical_stage text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Course sections
CREATE TABLE public.course_sections (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  semester text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Teacher assignments (teacher to course-section)
CREATE TABLE public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_section_id uuid NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Course enrolments (student to course-section)
CREATE TABLE public.course_enrolments (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_section_id uuid NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Feedback (student submissions)
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id),
  programme text NOT NULL,
  study_structure text NOT NULL,
  study_stage text NOT NULL,
  university_service text NOT NULL,
  course_id uuid REFERENCES public.courses(id),
  course_section_id uuid REFERENCES public.course_sections(id),
  custom_course_name text,
  feedback_area text NOT NULL,
  feedback_types text[] NOT NULL DEFAULT '{}',
  topic text,
  original_text text NOT NULL,
  language_detected text,
  is_anonymous boolean NOT NULL DEFAULT true,
  is_sensitive boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'submitted',
  reference_number text NOT NULL UNIQUE,
  submitted_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  analysed_at timestamptz
);

-- Extracted issues (AI-identified issues within each feedback)
CREATE TABLE public.extracted_issues (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  issue_type text NOT NULL,
  problem_description text NOT NULL,
  topic text,
  sentiment text NOT NULL,
  semantic_tag text NOT NULL,
  suggested_category text,
  ai_confidence numeric CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
  review_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Issue clusters (grouped similar problems)
CREATE TABLE public.issue_clusters (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  canonical_tag text NOT NULL,
  course_id uuid REFERENCES public.courses(id),
  department_id uuid REFERENCES public.departments(id),
  university_service text,
  feedback_area text,
  report_count integer NOT NULL DEFAULT 0 CHECK (report_count >= 0),
  feedback_share numeric,
  sentiment_primary text,
  trend text NOT NULL DEFAULT 'stable',
  priority_level text NOT NULL DEFAULT 'low',
  priority_score numeric,
  priority_factors jsonb,
  ai_suggested_response text,
  ai_suggested_department text,
  is_sensitive boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Cluster feedback junction (many-to-many)
CREATE TABLE public.cluster_feedback (
  cluster_id uuid NOT NULL REFERENCES public.issue_clusters(id) ON DELETE CASCADE,
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  extracted_issue_id uuid NOT NULL REFERENCES public.extracted_issues(id) ON DELETE CASCADE,
  PRIMARY KEY (cluster_id, feedback_id, extracted_issue_id)
);

-- Cluster tag synonyms (cross-language grouping)
CREATE TABLE public.cluster_tag_synonyms (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  canonical_tag text NOT NULL,
  synonyms text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Actions (teaching or institutional responses)
CREATE TABLE public.actions (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.issue_clusters(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  responsible_department text,
  responsible_person text,
  deadline date,
  internal_note text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- Action updates (progress notes and student-facing responses)
CREATE TABLE public.action_updates (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  student_facing_message text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  published_by uuid REFERENCES public.profiles(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

-- ============================================================================
-- 2. CHECK CONSTRAINTS
-- ============================================================================

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_role
    CHECK (role IN ('student', 'teacher', 'admin')),
  ADD CONSTRAINT chk_profiles_study_structure
    CHECK (study_structure IS NULL OR study_structure IN ('semester', 'year'));

ALTER TABLE public.departments
  ADD CONSTRAINT chk_departments_type
    CHECK (type IN ('academic', 'administrative', 'service'));

ALTER TABLE public.feedback
  ADD CONSTRAINT chk_feedback_status
    CHECK (status IN ('submitted', 'analysed', 'under_review', 'assigned', 'in_progress', 'resolved')),
  ADD CONSTRAINT chk_feedback_language
    CHECK (language_detected IS NULL OR language_detected IN ('en', 'ur', 'roman_ur', 'mixed')),
  ADD CONSTRAINT chk_feedback_study_structure
    CHECK (study_structure IN ('semester', 'year'));

ALTER TABLE public.extracted_issues
  ADD CONSTRAINT chk_issues_type
    CHECK (issue_type IN ('learning_difficulty', 'problem', 'suggestion', 'positive', 'support_request')),
  ADD CONSTRAINT chk_issues_sentiment
    CHECK (sentiment IN ('negative', 'neutral', 'positive')),
  ADD CONSTRAINT chk_issues_review
    CHECK (review_status IN ('pending', 'reviewed', 'rejected'));

ALTER TABLE public.issue_clusters
  ADD CONSTRAINT chk_clusters_priority
    CHECK (priority_level IN ('high', 'medium', 'low')),
  ADD CONSTRAINT chk_clusters_trend
    CHECK (trend IN ('increasing', 'stable', 'improving')),
  ADD CONSTRAINT chk_clusters_status
    CHECK (status IN ('open', 'acknowledged', 'action_created', 'closed')),
  ADD CONSTRAINT chk_clusters_sentiment
    CHECK (sentiment_primary IS NULL OR sentiment_primary IN ('negative', 'neutral', 'positive'));

ALTER TABLE public.actions
  ADD CONSTRAINT chk_actions_type
    CHECK (action_type IN ('teaching', 'institutional')),
  ADD CONSTRAINT chk_actions_status
    CHECK (status IN ('planned', 'assigned', 'in_progress', 'completed'));

-- ============================================================================
-- 3. UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE public.teacher_assignments
  ADD CONSTRAINT uq_teacher_section UNIQUE (teacher_id, course_section_id);

ALTER TABLE public.cluster_tag_synonyms
  ADD CONSTRAINT uq_cluster_tag_synonyms_canonical_tag UNIQUE (canonical_tag);

ALTER TABLE public.course_enrolments
  ADD CONSTRAINT uq_student_enrolment UNIQUE (student_id, course_section_id);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- Profiles
CREATE INDEX idx_profiles_role ON public.profiles (role);
CREATE INDEX idx_profiles_department ON public.profiles (department_id);
CREATE INDEX idx_profiles_email ON public.profiles (email);

-- Courses
CREATE INDEX idx_courses_department ON public.courses (department_id);

-- Course sections
CREATE INDEX idx_course_sections_course ON public.course_sections (course_id);

-- Teacher assignments
CREATE INDEX idx_teacher_assignments_teacher ON public.teacher_assignments (teacher_id);
CREATE INDEX idx_teacher_assignments_section ON public.teacher_assignments (course_section_id);

-- Course enrolments
CREATE INDEX idx_course_enrolments_student ON public.course_enrolments (student_id);
CREATE INDEX idx_course_enrolments_section ON public.course_enrolments (course_section_id);

-- Feedback
CREATE INDEX idx_feedback_student ON public.feedback (student_id);
CREATE INDEX idx_feedback_department ON public.feedback (department_id);
CREATE INDEX idx_feedback_course ON public.feedback (course_id) WHERE course_id IS NOT NULL;
CREATE INDEX idx_feedback_section ON public.feedback (course_section_id) WHERE course_section_id IS NOT NULL;
CREATE INDEX idx_feedback_status ON public.feedback (status);
CREATE INDEX idx_feedback_submitted_at ON public.feedback (submitted_at DESC);
CREATE INDEX idx_feedback_sensitive ON public.feedback (is_sensitive) WHERE is_sensitive = true;
CREATE INDEX idx_feedback_reference ON public.feedback (reference_number);

-- Extracted issues
CREATE INDEX idx_extracted_issues_feedback ON public.extracted_issues (feedback_id);
CREATE INDEX idx_extracted_issues_tag ON public.extracted_issues (semantic_tag);
CREATE INDEX idx_extracted_issues_review ON public.extracted_issues (review_status) WHERE review_status = 'pending';

-- Issue clusters
CREATE INDEX idx_clusters_course ON public.issue_clusters (course_id) WHERE course_id IS NOT NULL;
CREATE INDEX idx_clusters_department ON public.issue_clusters (department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_clusters_priority ON public.issue_clusters (priority_level, priority_score DESC);
CREATE INDEX idx_clusters_status ON public.issue_clusters (status);
CREATE INDEX idx_clusters_canonical_tag ON public.issue_clusters (canonical_tag);

-- Cluster feedback (junction)
CREATE INDEX idx_cluster_feedback_cluster ON public.cluster_feedback (cluster_id);
CREATE INDEX idx_cluster_feedback_feedback ON public.cluster_feedback (feedback_id);

-- Actions
CREATE INDEX idx_actions_cluster ON public.actions (cluster_id);
CREATE INDEX idx_actions_status ON public.actions (status);
CREATE INDEX idx_actions_deadline ON public.actions (deadline)
  WHERE deadline IS NOT NULL AND status != 'completed';
CREATE INDEX idx_actions_created_by ON public.actions (created_by);

-- Action updates
CREATE INDEX idx_action_updates_action ON public.action_updates (action_id);
CREATE INDEX idx_action_updates_published ON public.action_updates (is_published)
  WHERE is_published = true;

-- ============================================================================
-- 5. PRIVATE HELPER FUNCTIONS
-- ============================================================================
-- These functions live in the private schema so they are NOT directly
-- callable through the Supabase Data API (PostgREST serves only public).
-- They are used internally by views, RLS policies, and RPCs.

-- Returns the current user's role from public.profiles.
-- STABLE: result is consistent within a single statement.
-- SECURITY DEFINER: bypasses RLS on public.profiles to avoid policy recursion.
CREATE OR REPLACE FUNCTION private.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.get_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_user_role() FROM anon;
REVOKE ALL ON FUNCTION private.get_user_role() FROM authenticated;
-- Must remain callable by authenticated: used in RLS policy expressions.
GRANT EXECUTE ON FUNCTION private.get_user_role() TO authenticated;

-- Returns the course-section IDs assigned to a given teacher.
CREATE OR REPLACE FUNCTION private.get_teacher_section_ids(p_teacher_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.coalesce(pg_catalog.array_agg(course_section_id), '{}')
  FROM public.teacher_assignments
  WHERE teacher_id = p_teacher_id;
$$;

REVOKE ALL ON FUNCTION private.get_teacher_section_ids(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_teacher_section_ids(uuid) FROM anon;
REVOKE ALL ON FUNCTION private.get_teacher_section_ids(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.get_teacher_section_ids(uuid) TO service_role;

-- Checks whether a teacher is assigned to a specific section.
CREATE OR REPLACE FUNCTION private.is_teacher_assigned_to_section(p_teacher_id uuid, p_section_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments
    WHERE teacher_id = p_teacher_id AND course_section_id = p_section_id
  );
$$;

REVOKE ALL ON FUNCTION private.is_teacher_assigned_to_section(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_teacher_assigned_to_section(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION private.is_teacher_assigned_to_section(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.is_teacher_assigned_to_section(uuid, uuid) TO service_role;

-- Returns section IDs for the CURRENTLY AUTHENTICATED teacher only.
-- Does not accept arbitrary teacher IDs, preventing enumeration.
CREATE OR REPLACE FUNCTION private.get_my_section_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.coalesce(pg_catalog.array_agg(course_section_id), '{}')
  FROM public.teacher_assignments
  WHERE teacher_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION private.get_my_section_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_my_section_ids() FROM anon;
REVOKE ALL ON FUNCTION private.get_my_section_ids() FROM authenticated;
-- Only used inside SECURITY DEFINER RPCs (owner bypasses grants).
GRANT EXECUTE ON FUNCTION private.get_my_section_ids() TO service_role;

-- ============================================================================
-- 6. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_issue_clusters_updated_at
  BEFORE UPDATE ON public.issue_clusters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_actions_updated_at
  BEFORE UPDATE ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7. AUTH SIGNUP TRIGGER
-- ============================================================================
-- Automatically creates a public.profiles row with role='student' whenever
-- a new user registers through Supabase Auth.  Metadata fields are captured
-- if provided, but role is ALWAYS forced to 'student'.
-- Teacher and admin roles can only be assigned by an administrator.

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, programme, study_structure, study_stage, avatar_initials)
  VALUES (
    NEW.id,
    pg_catalog.coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    'student',
    NEW.raw_user_meta_data->>'programme',
    NEW.raw_user_meta_data->>'study_structure',
    NEW.raw_user_meta_data->>'study_stage',
    NEW.raw_user_meta_data->>'avatar_initials'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();
