# IlmVox AI — Project Scope

## 1. Project Overview

IlmVox AI is a multilingual student-feedback intelligence and institutional action-tracking platform designed initially for Pakistani universities.

The system will enable students to provide feedback naturally in English, Urdu, Roman Urdu or mixed Urdu–English. It will convert this feedback into structured, evidence-backed insights that help teachers and university administrators identify real academic and institutional problems, determine where those problems occur and take appropriate action.

IlmVox AI is not simply a feedback form, satisfaction survey or sentiment-analysis dashboard. Its central purpose is to close the gap between student feedback and visible university action.

## 2. Problem Statement

Universities collect student feedback through questionnaires, forms and surveys, but much of this information is reduced to general satisfaction percentages or stored in spreadsheets and reports.

This approach may fail to identify:

- The exact problem students are experiencing
- The course, topic, section, service or location where it occurs
- Whether different students are describing the same problem in different languages
- How widespread or urgent the problem is
- Who is responsible for reviewing it
- Whether any action was taken
- Whether students were informed about the response

Pakistani students may communicate through English, Urdu, Roman Urdu and mixed Urdu–English. Conventional feedback systems may not effectively analyse these multilingual and code-switched responses.

## 3. Proposed Solution

IlmVox AI will provide a structured feedback-to-action process:

1. A student submits multilingual feedback.
2. The system preserves the original comment.
3. The system identifies separate issues contained within the feedback.
4. It identifies what the reported problem is.
5. It identifies where the problem occurs.
6. Similar feedback is grouped across supported languages.
7. The system presents counts, percentages, trends and supporting evidence.
8. Priority is calculated through transparent factors.
9. A teacher or administrator reviews the insight.
10. An appropriate action is created and assigned.
11. Progress is tracked.
12. Students receive an approved action update.

## 4. Target Users

IlmVox AI will initially support three user roles:

### 4.1 Student

Students will submit multilingual feedback, track its status and view approved teacher or university updates.

### 4.2 Teacher

Teachers will review feedback concerning their assigned courses and sections, identify learning bottlenecks, examine supporting evidence and record teaching-related actions.

### 4.3 Administrator

Administrators will review institution-level problems, assign responsible departments or action owners, monitor deadlines and publish appropriate student-facing updates.

## 5. Core MVP Features

The five-day hackathon MVP should include:

- One shared login interface
- Student, teacher and administrator roles
- Role-based access
- Student feedback submission
- Support for English, Urdu, Roman Urdu and mixed Urdu–English
- Course, section, topic and feedback-area selection
- Preservation of original feedback
- Identification of separate issues within one comment
- Identification of the exact reported problem and its location
- Per-issue sentiment
- Cross-language problem grouping
- Supporting anonymised evidence
- Counts and correctly labelled percentages
- Feedback trend
- Explainable priority
- Teacher review and teaching-action creation
- Administrator action assignment
- Action-status tracking
- Approved student-facing updates
- A complete demonstration workflow

## 6. Primary Demonstration Workflow

The main prototype demonstration will show:

1. A student logs in.
2. The student submits mixed Urdu–English feedback.
3. IlmVox AI identifies the relevant course, topic and learning problem.
4. The system separates multiple issues where necessary.
5. Equivalent feedback across languages is grouped.
6. A teacher reviews the learning bottleneck and supporting evidence.
7. The system explains why the problem has a particular priority.
8. The teacher or administrator creates an action.
9. The action status is updated.
10. The student views the published response.

## 7. Example Use Case

Student feedback:
> “Pointers samajh aa gaye hain but abstraction ke sath relation clear nahi.”

Expected structured interpretation:

- Feedback type: Academic learning difficulty
- Course: Object-Oriented Programming
- Topics: Pointers and abstraction
- Exact reported problem: Difficulty connecting pointers with abstraction
- Location: Selected course, section and topic
- Responsible user: Assigned OOP teacher
- Evidence: Original anonymised student comment
- Interpretation status: AI-generated; teacher review required

The system must not present an uncertain underlying cause as a proven fact.

## 8. Priority Principles

Priority will not be based only on negative sentiment. It will consider transparent factors such as:

- Frequency of related reports
- Effect on learning, assessment or essential services
- Time sensitivity
- Whether the problem is increasing
- Whether it affects multiple sections or departments

Users must be able to select “Why this priority?” and view the supporting factors.

## 9. Human and AI Responsibilities

AI may support:

- Language detection
- Issue extraction
- Per-issue sentiment analysis
- Cross-language grouping
- Problem summarisation
- Suggested responsible department
- Suggested action

The application will calculate priority through transparent rules.

Teachers and administrators will remain responsible for:

- Reviewing AI interpretations
- Making final decisions
- Assigning actions
- Updating progress
- Approving student-facing responses

AI-generated interpretations and recommendations must be clearly labelled as requiring human review.

## 10. Ethical and Safety Boundaries

IlmVox AI must:

- Protect student identities
- Restrict access according to role
- Avoid ranking teachers through sentiment
- Preserve original feedback as evidence
- Distinguish evidence from AI interpretation
- Prevent students from registering as teachers or administrators
- Route sensitive allegations through restricted institutional channels
- Avoid automatically investigating or deciding serious cases
- Require human approval before publishing responses

## 11. Features Excluded from the Hackathon MVP

The initial MVP will not include:

- A native mobile application
- Live LMS integration
- Payment functionality
- Voice feedback
- A chatbot
- A personal AI tutor
- Predictive analytics
- Fully automated university decisions
- Complex multi-university onboarding
- Every possible university configuration
- Additional regional languages beyond the current supported formats

## 12. Success Criteria

The MVP will be considered successful if it demonstrates that:

- A student can submit multilingual feedback.
- IlmVox AI can identify what the problem is and where it occurs.
- Similar feedback can be grouped across supported languages.
- Teachers can view evidence-backed learning insights.
- Priority can be explained transparently.
- An authorised user can create and track an action.
- Students can see an appropriate action update.
- Each user role can access only the information relevant to its responsibility.

## 13. Core Product Statement

IlmVox AI is a multilingual student-voice-to-institutional-action platform that identifies what problem students face, where it occurs, how serious and widespread it is, and whether the responsible university unit acted on it.
