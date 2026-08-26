import type {
  FeedbackStatus,
  ActionStatus,
  PriorityLevel,
  TrendDirection,
  Sentiment,
} from './types'

// ---------------------------------------------------------------------------
// Feedback status labels and colours
// ---------------------------------------------------------------------------

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  submitted: 'Submitted',
  analysed: 'Analysed',
  under_review: 'Under Review',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
}

export const FEEDBACK_STATUS_COLOURS: Record<FeedbackStatus, string> = {
  submitted: 'bg-soft-blue text-ocean',
  analysed: 'bg-soft-teal text-teal-dark',
  under_review: 'bg-soft-amber text-warning',
  assigned: 'bg-soft-teal text-teal-dark',
  in_progress: 'bg-soft-amber text-warning',
  resolved: 'bg-soft-teal text-success',
}

// ---------------------------------------------------------------------------
// Action status labels
// ---------------------------------------------------------------------------

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  planned: 'Planned',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
}

// ---------------------------------------------------------------------------
// Priority labels and colours
// ---------------------------------------------------------------------------

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const PRIORITY_COLOURS: Record<PriorityLevel, string> = {
  high: 'bg-soft-red text-danger',
  medium: 'bg-soft-amber text-warning',
  low: 'bg-soft-teal text-success',
}

// ---------------------------------------------------------------------------
// Priority weights (approved formula)
// ---------------------------------------------------------------------------

export const PRIORITY_WEIGHTS = {
  frequency: 0.35,
  impact: 0.30,
  urgency: 0.20,
  trend: 0.15,
} as const

// ---------------------------------------------------------------------------
// Trend labels and arrows
// ---------------------------------------------------------------------------

export const TREND_LABELS: Record<TrendDirection, string> = {
  increasing: 'Increasing',
  stable: 'Stable',
  improving: 'Improving',
}

export const TREND_ARROWS: Record<TrendDirection, string> = {
  increasing: '↗',
  stable: '—',
  improving: '↘',
}

export const TREND_COLOURS: Record<TrendDirection, string> = {
  increasing: 'text-danger',
  stable: 'text-muted',
  improving: 'text-success',
}

// ---------------------------------------------------------------------------
// Sentiment
// ---------------------------------------------------------------------------

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  negative: 'Negative',
  neutral: 'Neutral',
  positive: 'Positive',
}

// ---------------------------------------------------------------------------
// Form options — from submit feedback wireframe
// ---------------------------------------------------------------------------

export const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Engineering',
  'Business and Management',
  'Mathematics and Statistics',
  'Economics and Finance',
  'Psychology and Behavioural Sciences',
  'Natural Sciences',
  'Social Sciences',
  'Humanities and Languages',
  'Health and Medical Sciences',
  'Law',
  'Education',
  'Arts and Design',
  'Media and Communication',
  'Architecture and Planning',
  'Agriculture and Environmental Sciences',
] as const

export const PROGRAMMES = [
  'BS Computer Science',
  'BS Software Engineering',
  'BS Information Technology',
  'BS Artificial Intelligence',
  'BS Data Science',
  'Bachelor of Business Administration',
  'BS Electrical Engineering',
  'BS Mechanical Engineering',
  'BS Civil Engineering',
  'MBBS',
  'LLB',
  'BS Education',
] as const

export const UNIVERSITY_SERVICES = [
  'Courses and Teaching',
  'Assessments and Examinations',
  'Academic Advising and Support',
  'Laboratory and Practical Facilities',
  'Library and Learning Resources',
  'IT, Wi-Fi and Learning Management System',
  'Admissions and Registration',
  'Student Records',
  'Fees and Financial Services',
  'Student Affairs',
  'Career Services',
  'Health and Counselling',
  'Accessibility and Inclusion',
  'Campus Facilities',
  'Transport',
  'Hostel and Accommodation',
  'Cafeteria and Food Services',
  'Safety and Security',
  'Clubs and Student Activities',
] as const

export const FEEDBACK_AREAS = [
  'Difficulty understanding a concept',
  'Difficulty applying knowledge',
  'Teaching pace or explanation',
  'Course content or organisation',
  'Learning materials and resources',
  'Assignment instructions',
  'Assessment design or fairness',
  'Grading clarity',
  'Timetable or scheduling',
  'Staff communication or availability',
  'Technical access or system failure',
  'Service availability or delay',
  'Facilities or equipment condition',
  'Accessibility or inclusion',
  'Student wellbeing or support',
  'Positive experience',
  'Suggestion for improvement',
  'Sensitive or serious concern',
] as const

export const FEEDBACK_TYPES = [
  'Learning difficulty',
  'Positive feedback',
  'Problem or complaint',
  'Suggestion',
  'Request for support',
] as const

/**
 * BS Computer Science course catalogue by semester.
 * Matches the submit feedback wireframe prototype data.
 */
export const BSCS_COURSES_BY_STAGE: Record<string, string[]> = {
  'Semester 1': [
    'Programming Fundamentals',
    'Discrete Structures',
    'Calculus and Analytical Geometry',
    'English Composition and Comprehension',
  ],
  'Semester 2': [
    'Object-Oriented Programming',
    'Database Systems',
    'Linear Algebra',
    'Probability and Statistics',
    'Communication and Presentation Skills',
  ],
  'Semester 3': [
    'Data Structures and Algorithms',
    'Information Security',
    'Artificial Intelligence',
    'Digital Logic Design',
    'Differential Equations',
  ],
  'Semester 4': [
    'Computer Networks',
    'Computer Organisation and Assembly Language',
    'Analysis of Algorithms',
  ],
  'Semester 5': [
    'Operating Systems',
    'Software Engineering',
    'Theory of Automata',
  ],
  'Semester 6': [
    'Parallel and Distributed Computing',
    'Compiler Construction',
    'Computing Elective',
  ],
  'Semester 7': [
    'Final-Year Project I',
    'Professional Practices',
    'Computing Elective',
  ],
  'Semester 8': [
    'Final-Year Project II',
    'Computing Elective',
    'University Elective',
  ],
}

/** Maximum feedback text length (characters). */
export const FEEDBACK_MAX_LENGTH = 1000

/** Admin action assignment departments (from admin wireframe). */
export const ADMIN_DEPARTMENTS = [
  'IT Department',
  'Examination Office',
  'Academic Department',
  'Student Affairs',
  'Library Management',
  'Facilities Department',
  'Transport Office',
  'Finance Department',
  'University Administration',
] as const
