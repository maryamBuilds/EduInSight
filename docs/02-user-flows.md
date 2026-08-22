# EduInSight — User Flows

## 1. Shared Login Flow

1. The user opens EduInSight.
2. The user enters their university email and password.
3. The system verifies the account and role.
4. The user is automatically directed to the correct dashboard.

- Student → Student Dashboard
- Teacher → Teacher Dashboard
- Administrator → Administration Dashboard

Users will not choose their own role during login.

## 2. Student Flow

1. The student logs in.
2. The student opens “Submit Feedback”.
3. The student selects:
   - Department
   - Course or university service
   - Section
   - Topic or feedback area
4. The student writes feedback in English, Urdu, Roman Urdu or mixed Urdu–English.
5. The student submits the feedback.
6. The system stores the original feedback.
7. The system analyses and organises the reported issue.
8. The student receives a submission confirmation.
9. The student can track the feedback status.
10. The student can view an approved action update.

Student status journey:

Submitted → Analysed → Under Review → Action Update

## 3. Teacher Flow

1. The teacher logs in.
2. The teacher sees assigned courses and sections.
3. The teacher opens a course.
4. The teacher views:
   - Common learning problems
   - Related feedback count
   - Correctly labelled percentage
   - Feedback trend
   - Priority
   - Supporting anonymised comments
5. The teacher opens a learning problem.
6. The teacher reviews the AI-generated interpretation.
7. The teacher may:
   - Acknowledge the problem
   - Create a teaching action
   - Forward the problem to the course coordinator
8. The teacher updates the action status.
9. An appropriate update may be published for students.

## 4. Administrator Flow

1. The administrator logs in.
2. The administrator views university-level issues.
3. The administrator filters issues by department, category or time.
4. The administrator opens a priority issue.
5. The administrator reviews:
   - Problem description
   - Affected area
   - Related feedback
   - Supporting evidence
   - Priority explanation
6. The administrator assigns the issue to a responsible department.
7. The administrator adds an action owner and deadline.
8. The responsible user updates progress.
9. The administrator monitors unresolved and overdue actions.
10. An approved response is published for students.

## 5. Main Feedback-to-Action Flow

Student submits feedback  
→ EduInSight identifies the problem  
→ Similar feedback is grouped  
→ Evidence and priority are displayed  
→ Teacher or administrator reviews it  
→ An action is created  
→ Progress is tracked  
→ Student receives an update

## 6. Sensitive Feedback Flow

1. The system detects that feedback may contain a sensitive allegation.
2. The feedback is excluded from ordinary dashboard analytics.
3. It is routed to a restricted authorised channel.
4. An authorised university representative reviews it.
5. EduInSight does not investigate or decide the case automatically.
