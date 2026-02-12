export const VALUE_PROPOSITIONS = `# Value Propositions (Angles) for Peach Cold Emails

Use this reference to select which angles to highlight in emails 2-4 based on research findings.

## Quick Reference Table

| Angle | Value | Best For |
|-------|-------|----------|
| Hyper-Personalisation | Very High | Academic leaders, curriculum heads, teachers |
| Learning Insights | High | Trustees, CEOs, multi-school leaders, dept heads |
| Centralised Curriculum | High | Curriculum heads, department heads |
| Authentic Assessment | High | Teachers, principals, curriculum/dept heads |
| Pedagogy | High | Teachers, curriculum/dept heads (AI-naive) |
| Teacher Workload | Medium | HR, teachers, principals, CEOs |
| Holistic AI | Medium | CEOs, trustees |
| Engagement | Medium | Teachers, department/curriculum heads |
| Handwriting Support | Medium | Schools with low device access or anti-device philosophy |
| Teaching Material | Medium | Teachers |
| Remediation | Medium | Teachers, department/curriculum heads |
| Customer Service | Low | IT heads, principals (bad EdTech experiences) |
| Flipped Classroom | Low | Teachers using flipped methodology |
| IB Coursework | Low | IB school staff |
| Academic Honesty | Low | Teachers, department/curriculum heads |
| Conversational Assignment | Low | Teachers, department/curriculum heads |

## HIGH VALUE ANGLES

### 1. Hyper-Personalisation
**Value:** Very High
**Target roles:** Academic leaders, curriculum heads, principals, department heads, teachers
**Triggers:** Person cares about personalisation or improving learning outcomes

**Messaging:**
High quality personalisation isn't just about allowing students to study at their own pace or adjusting difficulty levels; it's about making learning engaging and relevant.

Personalisation is driven by two forces: diagnosing student knowledge (to figure out what they should be working on) + creating personalised content (that fits your curriculum and the student's learning preferences). Peach excels at both.

**Why Peach diagnosis is better:**
- Peach sees all work a student has done across subjects and years
- Human teachers are siloed—a Physics teacher in Grade 11 doesn't know what happened in Grade 8 Physics or Grade 11 Math
- Peach finds patterns humans miss, enabling root cause remediation rather than repetitive practice
- Peach's AI tutor captures "invisible" learning happening at home (doubt resolution, exam revision)

**Why Peach content creation is better:**
- Reduces teacher content creation time from hours to minutes
- Contextualises content to each student's interests
- Trained by expert educators with deep understanding of pedagogy
- Can be trained on your specific curriculum

### 2. Learning Insights
**Value:** High
**Target roles:** Trustees, CEOs, Principals, multi-school leaders, department heads
**Triggers:** Person cares about consistency of academic outcomes across large cohorts, improving learning outcomes, or assessment quality

**Messaging:**
Most school leadership teams understand student performance via SIS/LMS data, but this data is typically surface-level:
- Most data isn't academic (e.g., attendance)
- Academic reporting typically revolves around grades only

Knowing a student averaged a "B" doesn't help identify steps to improve performance. Peach analyses every piece of work a student does to understand root causes behind academic issues and provide actionable insights.

### 3. Centralised Curriculum
**Value:** High
**Target roles:** Curriculum heads, department heads
**Triggers:** Person is part of a centralised curriculum team or creates content used by multiple teachers

**Messaging:**
Managing curriculum across multiple classrooms comes with challenges: ensuring alignment, maintaining quality, and giving teachers the right guidance. Peach helps curriculum heads bring consistency and pedagogical rigour to every unit.

### 4. Authentic Assessment
**Value:** High
**Target roles:** Teachers, principals, curriculum heads, department heads
**Triggers:** Person has talked about quality of assessments or improving learning outcomes

**Messaging:**
The most clear-cut use-case for AI in schools is in assessment. Peach automatically grades student work, easing teacher workload, bringing consistency for administrators, and providing students with instant high-quality feedback on submission.

### 5. Pedagogy
**Value:** High
**Target roles:** Teachers, curriculum heads, department heads
**Triggers:** Person has NOT thought much about AI in education (AI-naive)

**Messaging:**
Researchers at Wharton found that most AI tools are actually harmful to student learning. This is because most AI is designed for adults—AI is useful to adults when it removes cognitive burden. But for students, engaging with that cognitive burden is essential for developing thinking abilities.

Peach is designed to teach, not tell.

## MEDIUM VALUE ANGLES

### 6. Teacher Workload
**Value:** Medium
**Target roles:** HR, teachers, principals, CEOs
**Triggers:** Person cares about teacher retention/stress/workload

**Messaging:**
Using ChatGPT effectively can save teachers ~6h a week. Using Peach effectively can save teachers ~16h a week and unlock another ~34h of value by doing things teachers otherwise wouldn't.

### 7. Holistic AI
**Value:** Medium
**Target roles:** CEOs, trustees
**Triggers:** Person is talking about AI generally

**Messaging:**
For the past couple of years we've been teased with the promise that AI will transform education. But the AI tools we're actually using fall well short. Enter Peach, a platform that lets schools tap the real power of AI to deeply personalise and improve student learning.

### 8. Engagement
**Value:** Medium
**Target roles:** Teachers, department heads, curriculum heads
**Triggers:** Person is talking about challenges of getting students to engage

### 9. Handwriting Support
**Value:** Medium
**Target roles:** Teachers, principals, curriculum heads, department heads
**Triggers:** School has low device access (philosophical opposition or fees <$1500/year)

### 10. Teaching Material
**Value:** Medium
**Target roles:** Teachers
**Triggers:** General teacher outreach

### 11. Remediation
**Value:** Medium
**Target roles:** Teachers, department heads, curriculum heads
**Triggers:** General academic improvement focus

## LOW VALUE ANGLES (Use only with specific research evidence)

### 12. Customer Service
### 13. Flipped Classroom
### 14. IB Coursework
### 15. Academic Honesty
### 16. Conversational Assignment
`;

export const ANGLE_MAPPINGS = {
  "hyper-personalisation": {
    value: "very_high",
    roles: ["academic leader", "curriculum head", "principal", "department head", "teacher"],
    triggers: ["personalisation", "personalization", "learning outcomes", "differentiation"],
  },
  "learning-insights": {
    value: "high",
    roles: ["trustee", "ceo", "principal", "multi-school leader", "department head"],
    triggers: ["data", "analytics", "outcomes", "consistency", "assessment quality"],
  },
  "centralised-curriculum": {
    value: "high",
    roles: ["curriculum head", "department head"],
    triggers: ["curriculum", "alignment", "multiple teachers", "standards"],
  },
  "authentic-assessment": {
    value: "high",
    roles: ["teacher", "principal", "curriculum head", "department head"],
    triggers: ["assessment", "grading", "feedback", "evaluation"],
  },
  "pedagogy": {
    value: "high",
    roles: ["teacher", "curriculum head", "department head"],
    triggers: ["teaching methods", "ai concerns", "learning science"],
  },
  "teacher-workload": {
    value: "medium",
    roles: ["hr", "teacher", "principal", "ceo"],
    triggers: ["workload", "retention", "stress", "burnout", "time"],
  },
  "holistic-ai": {
    value: "medium",
    roles: ["ceo", "trustee"],
    triggers: ["ai strategy", "digital transformation", "innovation"],
  },
  "engagement": {
    value: "medium",
    roles: ["teacher", "department head", "curriculum head"],
    triggers: ["engagement", "motivation", "participation"],
  },
  "handwriting-support": {
    value: "medium",
    roles: ["teacher", "principal", "curriculum head", "department head"],
    triggers: ["low device", "handwriting", "offline", "screen time"],
  },
} as const;
