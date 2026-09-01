# IlmVox AI — Technical Architecture

## 1. Technology Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Recharts
- Lucide React icons

### Backend and Database

- Supabase
- PostgreSQL database
- Supabase Authentication
- Supabase Row Level Security

### AI Analysis

An existing multilingual AI API will be used for:

- Language identification
- Multi-issue extraction
- Problem identification
- Per-issue sentiment
- Feedback summarisation
- Suggested problem category
- Suggested responsible department

IlmVox AI will not train its own AI model during the five-day hackathon.

## 2. User Roles

The system will contain three roles:

- Student
- Teacher
- Administrator

After login, users will automatically access the dashboard assigned to their verified role.

Students will not be allowed to register themselves as teachers or administrators.

## 3. Main Database Tables

### Users

Stores:

- User ID
- Name
- University email
- Role
- Department
- Account status

### Departments

Stores university departments and responsible units.

### Courses

Stores:

- Course name
- Course code
- Department
- Assigned teacher

### Course Sections

Stores individual course sections and semesters.

### Enrolments

Connects students with their courses and sections.

### Teacher Assignments

Connects teachers with authorised courses and sections.

### Feedback

Stores:

- Student reference
- Original feedback
- Course or service
- Section
- Topic
- Submission language
- Anonymous status
- Submission date
- Current status

### Extracted Issues

Stores individual issues identified within each feedback submission:

- Issue type
- Problem description
- Topic
- Sentiment
- Suggested category
- AI confidence or review status

### Issue Clusters

Groups similar feedback into shared problems.

### Actions

Stores:

- Issue cluster
- Responsible department
- Action owner
- Proposed action
- Deadline
- Status
- Created date
- Completed date

### Action Updates

Stores progress notes and approved student-facing responses.

## 4. Main Data Flow

Student submits feedback  
→ Feedback is stored in the database  
→ AI analyses the feedback  
→ Separate issues are extracted  
→ Similar issues are grouped  
→ Priority is calculated  
→ Teacher or administrator reviews the evidence  
→ Action is created and assigned  
→ Action status is updated  
→ Student receives an approved update

## 5. Priority Calculation

Priority will use transparent factors:

- Frequency
- Learning or institutional impact
- Urgency
- Trend
- Number of affected areas

AI may help interpret the issue, but the final priority will be calculated through application rules.

Users will be able to view why an issue received its priority level.

## 6. Security and Access

- Passwords will be managed by Supabase Authentication.
- Students will access only their own submissions and published updates.
- Teachers will access only assigned courses and sections.
- Administrators will access authorised university-level information.
- Student identities will not automatically appear in teacher analytics.
- Sensitive feedback will be restricted from ordinary dashboards.
- Database access will be protected through Row Level Security policies.
- Secret API keys will not be stored directly in frontend code.

## 7. MVP Data Strategy

The prototype will initially use:

- One demonstration university
- One Computer Science department
- Two courses
- Three user roles
- A small number of demonstration accounts
- Approximately 40–60 synthetic multilingual feedback records
- A limited number of tested problem clusters

Synthetic data will be clearly labelled as prototype testing data.

## 8. Future Technical Enhancements

- University SSO
- LMS integration
- Additional regional languages
- Advanced Roman Urdu processing
- Mobile application
- Multi-university architecture
- Predictive issue detection
- Advanced sensitive-feedback routing
- Large-scale institutional reporting
- Real-time notifications
