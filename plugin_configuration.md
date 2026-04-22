Plugin Configuration Matrix — Village Strong Pilot

Essential plugins and recommended configuration notes

1. H5P
- Use for interactive stories and branching scenarios.
- Preload H5P content into course template; set visibility to teachers/mentors.

2. Level Up XP (or equivalent)
- Configure XP sources to match Gamification Rules (module completion, reflections, forum posts).
- Map XP thresholds to rank badges.

3. Badges (Core + custom)
- Create badge images for Pathfinder→Champion and character badges.
- Set issuance rules tied to completion/XP or manual mentor award.

4. Checklist
- Use checklists for weekly challenge steps and mentor facilitation checklists.

5. Feedback module
- Set up mentor evaluation forms and post-session feedback surveys.

6. Certificate (Custom Certificate)
- Design Village Champion certificate and automate issuance on course completion.

7. Attendance
- Optional: track live session attendance for mentor reports.

8. BigBlueButtonBN
- Configure BBB server endpoint, secrets, and moderation roles.
- Set default recording and consent options according to policy.

9. Configurable Reports / Ad-hoc reporting tool
- Create cohort-level dashboards for completion, points, and mentor observations.

10. Redis Cache (not a plugin)
- Configure Moodle to use Redis for sessions and cache; improves performance for pilot.

11. Additional: cohort enrolment plugin
- Use cohort-sync or manual cohort enrolment methods for partner schools.

Security and privacy notes
- Restrict mentor observation forms to mentor & admin roles.
- Ensure reflection journals are private and visible only to participant and assigned mentors.

Upgrade notes
- Keep plugin versions compatible with Moodle 4.3+. Test upgrades in staging before production.
