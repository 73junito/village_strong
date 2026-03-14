Course Import Template — Hero's Path (Implementation Guidance)

Notes
This file describes the recommended Moodle course backup/import structure and settings to produce a clonable Hero's Path master course for partner deployment.

Course settings
- Format: Topics (10 topics + Module 0)
- Course shortname: heroes_path_master
- Course visible: No (make visible after enrolment)
- Completion tracking: enabled (student and activity completion)

Topic (module) structure (per topic)
1. Opening Reflection (Label + Video or Page)
   - Activity: Page (intro) with embedded video
   - Activity completion: manual or view
2. Story Scenario
   - Activity: H5P (Interactive Content) or Page with narrative
   - Activity completion: view or passed (if H5P includes score)
3. Team Discussion
   - Activity: Forum (grouped by mentor groups)
   - Completion: post required
4. Decision Challenge
   - Activity: Quiz (question per scenario) or H5P branching
   - Completion: grade or pass
5. Leadership Lesson
   - Activity: Lesson or Page
   - Completion: view
6. Reflection Journal
   - Activity: Assignment (private submission) — set submission type to 'Online text' and visible only to mentor and admin.
   - Completion: submitted
7. Points & Badge triggers
   - Configure Level Up XP rules to award points on activity completion and manual mentor awards.

Activities to include in the master course
- H5P placeholders with content IDs to be replaced per cohort
- Forum with groups enabled for small-team discussions
- Assignment template for private reflection
- Quiz template for decision challenges
- Custom feedback form for mentor observations (set to hidden from participants)

Completion rules
- Set activity completion requirements per the Gamification Rules.
- Create course completion condition: completion of core modules + minimum reflection submissions + mentor approval.

Backup/export
- After building the master course, create a full course backup (.mbz) including activities, files, and course settings.
- Exclude user data when exporting the master template.

Import for cohort
- Use course restore process and choose to create a new course with all settings preserved.
- Update cohort-specific H5P IDs and mentor assignment settings after restore.

Testing checklist after import
- Validate activity completion rules work as expected
- Verify reflection privacy (only visible to participant and assigned mentor)
- Test badge issuance and XP tracking
- Test BigBlueButton activity and recording settings with a mock session

Developer notes
- If automated import scripting is desired, use Moodle's CLI restore API and parameterize course shortname and cohort assignments.
- Maintain a versioned course backup for each major curriculum update.
