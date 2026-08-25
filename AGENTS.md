# EduInSight Project Rules

## Visual Identity
- Preserve the EduInSight name, graph logo and navy-teal-ivory visual design.
- Treat all existing wireframes as approved visual references.
- Preserve the existing wireframe files until replacement pages are tested.

## Data Integrity
- Do not invent data and present it as real.
- Clearly label synthetic or demonstration data.

## Security & Authentication
- Use Supabase for authentication and database storage.
- Never expose Supabase service-role keys, database passwords or AI API secrets in frontend code.

## Role Management
- Students cannot select teacher or administrator roles.
- Teacher and administrator roles must be assigned by an authorised administrator.

## Feedback Handling
- Preserve English, Urdu, Roman Urdu and mixed Urdu-English feedback.
- Always retain the original feedback text.

## AI Recommendations
- AI recommendations are suggestions requiring human review.

## Development Workflow
- Implement one small feature at a time.
- Test every change before declaring it complete.
- Do not modify unrelated files.
- Explain important architectural changes before implementing them.
