// Transparent rules baseline: what a plain structured form could report
// without any AI.  Category comes straight from the area the student picked,
// the responsible area from the selected university service, and language
// from script and function-word counts.  The AI analysis should be judged by
// how much it improves on this, not only by its absolute scores.

import type { EvalCase, Prediction } from './metrics.ts'

const SERVICE_TO_RESPONSIBLE_AREA: Record<string, string> = {
  'Courses and Teaching': 'Academic Department',
  'Assessments and Examinations': 'Examination Office',
  'Academic Advising and Support': 'Academic Department',
  'Laboratory and Practical Facilities': 'Facilities Department',
  'Library and Learning Resources': 'Library Management',
  'IT, Wi-Fi and Learning Management System': 'IT Department',
  'Admissions and Registration': 'University Administration',
  'Student Records': 'University Administration',
  'Fees and Financial Services': 'Finance Department',
  'Student Affairs': 'Student Affairs',
  'Career Services': 'Student Affairs',
  'Health and Counselling': 'Student Affairs',
  'Accessibility and Inclusion': 'Student Affairs',
  'Campus Facilities': 'Facilities Department',
  Transport: 'Transport Office',
  'Hostel and Accommodation': 'Student Affairs',
  'Cafeteria and Food Services': 'Facilities Department',
  'Safety and Security': 'University Administration',
  'Clubs and Student Activities': 'Student Affairs',
}

const HIGH_PRIORITY_AREAS = new Set([
  'Sensitive or serious concern',
  'Accessibility or inclusion',
  'Student wellbeing or support',
])
const LOW_PRIORITY_AREAS = new Set(['Positive experience', 'Suggestion for improvement'])

// Small closed-class word lists; deliberately simple so the baseline stays
// easy to explain.
const ENGLISH_FUNCTION_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'and', 'but', 'so', 'i', 'we', 'my', 'our', 'to', 'of',
  'in', 'for', 'it', 'this', 'that', 'not', 'can', 'could', 'would', 'have', 'has', 'with',
  'there', 'they', 'during', 'on', 'at', 'be', 'us', 'every', 'never', 'should', 'please',
])
const ROMAN_URDU_FUNCTION_WORDS = new Set([
  'ka', 'ki', 'ke', 'k', 'ko', 'se', 'mein', 'me', 'hai', 'hain', 'tha', 'thi', 'thay', 'nahi',
  'nai', 'aur', 'bhi', 'ye', 'yeh', 'woh', 'wo', 'kya', 'kaise', 'kab', 'pe', 'par', 'pr', 'jo',
  'hoon', 'hun', 'mujhe', 'humein', 'hum', 'main', 'apna', 'apni', 'meray', 'mera', 'meri',
  'wala', 'wali', 'raha', 'rahe', 'ho', 'jata', 'jati', 'gaya', 'gaye', 'diya', 'kar', 'kr',
  'karo', 'karein', 'bohat', 'lekin', 'agar', 'isay', 'usay', 'dafa', 'baar', 'sirf', 'bas',
])

export function detectLanguageByRules(text: string): string {
  const arabicLetters = (text.match(/[؀-ۿ]/g) ?? []).length
  const latinLetters = (text.match(/[A-Za-z]/g) ?? []).length
  if (arabicLetters > 0 && latinLetters > 0) {
    return arabicLetters / (arabicLetters + latinLetters) > 0.9 ? 'ur' : 'mixed'
  }
  if (arabicLetters > 0) return 'ur'

  const words = text.toLowerCase().match(/[a-z']+/g) ?? []
  const english = words.filter((word) => ENGLISH_FUNCTION_WORDS.has(word)).length
  const urdu = words.filter((word) => ROMAN_URDU_FUNCTION_WORDS.has(word)).length
  if (urdu === 0) return 'en'
  if (english === 0) return 'roman_ur'
  const englishShare = english / (english + urdu)
  if (englishShare >= 0.75) return 'en'
  if (englishShare <= 0.2) return 'roman_ur'
  return 'mixed'
}

export function baselinePrediction(evalCase: EvalCase): Prediction {
  const area = evalCase.studentSelectedArea
  return {
    caseId: evalCase.id,
    ok: true,
    detectedLanguage: detectLanguageByRules(evalCase.text),
    category: area,
    sentiment:
      area === 'Positive experience'
        ? 'positive'
        : area === 'Suggestion for improvement'
          ? 'neutral'
          : 'negative',
    priority: HIGH_PRIORITY_AREAS.has(area) ? 'high' : LOW_PRIORITY_AREAS.has(area) ? 'low' : 'medium',
    responsibleArea: SERVICE_TO_RESPONSIBLE_AREA[evalCase.universityService] ?? null,
    requiresHumanReview: true,
    confidence: null,
  }
}
