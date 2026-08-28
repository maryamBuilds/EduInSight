-- EduInSight — Approved demonstration catalogue
-- Migration: 004_demo_catalogue.sql
--
-- Synthetic prototype data based on the approved Submit Feedback wireframe.
-- Safe to run more than once: every insert is guarded by NOT EXISTS.

INSERT INTO public.departments (name, type)
SELECT seed.name, 'academic'
FROM (
  VALUES
    ('Computer Science'),
    ('Information Technology'),
    ('Engineering'),
    ('Business and Management'),
    ('Mathematics and Statistics'),
    ('Economics and Finance'),
    ('Psychology and Behavioural Sciences'),
    ('Natural Sciences'),
    ('Social Sciences'),
    ('Humanities and Languages'),
    ('Health and Medical Sciences'),
    ('Law'),
    ('Education'),
    ('Arts and Design'),
    ('Media and Communication'),
    ('Architecture and Planning'),
    ('Agriculture and Environmental Sciences')
) AS seed(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.departments department
  WHERE department.name = seed.name
);

INSERT INTO public.courses (name, code, department_id, typical_stage, is_active)
SELECT
  seed.name,
  NULL,
  department.id,
  seed.typical_stage,
  true
FROM (
  VALUES
    ('Programming Fundamentals', 'Semester 1'),
    ('Discrete Structures', 'Semester 1'),
    ('Calculus and Analytical Geometry', 'Semester 1'),
    ('English Composition and Comprehension', 'Semester 1'),
    ('Object-Oriented Programming', 'Semester 2'),
    ('Database Systems', 'Semester 2'),
    ('Linear Algebra', 'Semester 2'),
    ('Probability and Statistics', 'Semester 2'),
    ('Communication and Presentation Skills', 'Semester 2'),
    ('Data Structures and Algorithms', 'Semester 3'),
    ('Information Security', 'Semester 3'),
    ('Artificial Intelligence', 'Semester 3'),
    ('Digital Logic Design', 'Semester 3'),
    ('Differential Equations', 'Semester 3'),
    ('Computer Networks', 'Semester 4'),
    ('Computer Organisation and Assembly Language', 'Semester 4'),
    ('Analysis of Algorithms', 'Semester 4'),
    ('Operating Systems', 'Semester 5'),
    ('Software Engineering', 'Semester 5'),
    ('Theory of Automata', 'Semester 5'),
    ('Parallel and Distributed Computing', 'Semester 6'),
    ('Compiler Construction', 'Semester 6'),
    ('Computing Elective', 'Semester 6'),
    ('Final-Year Project I', 'Semester 7'),
    ('Professional Practices', 'Semester 7'),
    ('Computing Elective', 'Semester 7'),
    ('Final-Year Project II', 'Semester 8'),
    ('Computing Elective', 'Semester 8'),
    ('University Elective', 'Semester 8')
) AS seed(name, typical_stage)
CROSS JOIN LATERAL (
  SELECT id
  FROM public.departments
  WHERE name = 'Computer Science'
  ORDER BY created_at
  LIMIT 1
) AS department
WHERE NOT EXISTS (
  SELECT 1
  FROM public.courses course
  WHERE course.department_id = department.id
    AND course.name = seed.name
    AND course.typical_stage = seed.typical_stage
);
