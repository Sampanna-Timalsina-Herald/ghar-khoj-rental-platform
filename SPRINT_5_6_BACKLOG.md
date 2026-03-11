# SPRINT BACKLOG - RENT AGREEMENT & RECOMMENDATION ENGINE (2025/11/25 TO 2026/01/20)

## SPRINT 5 - RENT AGREEMENT MODULE

### User Stories

| Role | User Story | Acceptance Criteria | Priority | Sprint |
|------|-----------|---------------------|----------|---------|
| Landlord | As a landlord, I want to generate a PDF rent agreement so that I have a formal document for the rental. | 1. PDF includes Tenant, Landlord, and Property details.<br>2. Terms and conditions are auto-filled into the template.<br>3. PDF is downloadable by both Landlord and Tenant. | Must be | Sprint 5 |
| Landlord | As a landlord, I want to review agreement terms before finalizing so that I can ensure accuracy. | 1. Landlord can view draft agreement before sending to tenant.<br>2. Edit option available for rent amount, duration, and special terms.<br>3. Version control tracks changes made to the agreement. | Must be | Sprint 5 |
| Tenant | As a tenant, I want to digitally sign the rent agreement so that the process is quick and legally binding. | 1. E-signature interface integrated into the platform.<br>2. Signed agreement is timestamped and stored securely.<br>3. Email confirmation sent to both parties after signing. | Must be | Sprint 5 |
| Tenant | As a tenant, I want to view all my rental agreements so that I can access them anytime. | 1. Dashboard displays list of all agreements (active, expired, pending).<br>2. Filter by status and property name.<br>3. Download option available for each agreement. | Should be | Sprint 5 |
| Admin | As an admin, I want to view all rental agreements so that I can monitor platform activity. | 1. Master list showing all agreements across the platform.<br>2. Search by tenant name, landlord name, or property ID.<br>3. Filter by status (draft, signed, active, expired, terminated). | Must be | Sprint 5 |
| Admin | As an admin, I want to delete invalid agreements so that I can maintain data quality. | 1. Soft delete functionality (agreement hidden, not erased).<br>2. Deletion triggers notification to involved parties.<br>3. Audit log records admin action with timestamp. | Must be | Sprint 5 |
| System | As the system, I want to send reminders for pending agreements so that deadlines are not missed. | 1. Auto-reminder sent 48 hours before agreement start date.<br>2. Reminder sent if agreement unsigned after 7 days.<br>3. Escalation email sent to landlord if no action after 14 days. | Should be | Sprint 5 |

---

### Sprint Backlog - Sprint 5

| Sprint | Task ID | Feature Category | Task Description | Team | Story Points | Status |
|--------|---------|------------------|------------------|------|--------------|--------|
| S5 | T5.1 | Agreement Generation | Create RentAgreement schema with fields: tenant, landlord, listing, terms, status, signatures, timestamps. | Backend | 3 | To Do |
| S5 | T5.2 | Agreement Generation | Build PDF template with dynamic fields (names, property details, rent amount, duration, terms). | Backend | 5 | To Do |
| S5 | T5.3 | Agreement Generation | Implement PDF generation service using pdf.js utility with signature placeholders. | Backend | 3 | To Do |
| S5 | T5.4 | Agreement API | Create POST /api/agreements endpoint to generate new agreement from rent request. | Backend | 2 | To Do |
| S5 | T5.5 | Agreement API | Create GET /api/agreements/:id endpoint with role-based access control. | Backend | 2 | To Do |
| S5 | T5.6 | Agreement API | Create PATCH /api/agreements/:id/edit endpoint for landlord to modify terms (draft status only). | Backend | 3 | To Do |
| S5 | T5.7 | E-Signature | Implement POST /api/agreements/:id/sign endpoint with validation and timestamp. | Backend | 4 | To Do |
| S5 | T5.8 | E-Signature | Add signature verification using hash and store signed PDF in uploads directory. | Backend | 4 | To Do |
| S5 | T5.9 | Agreement Workflow | Build status transition logic: draft → review → pending_signatures → signed → active → expired. | Backend | 3 | To Do |
| S5 | T5.10 | Audit Trail | Integrate audit-logger for all agreement actions (create, edit, sign, view, delete). | Backend | 2 | To Do |
| S5 | T5.11 | Notifications | Create email templates for: agreement created, review requested, signed, expired. | Backend | 2 | To Do |
| S5 | T5.12 | Reminders | Build cron job to check pending agreements and send reminder emails. | Backend | 3 | To Do |
| S5 | T5.13 | Admin Panel | Build Admin Master Table for "All Rental Agreements" with search and filters. | Frontend | 3 | To Do |
| S5 | T5.14 | Admin Panel | Implement soft-delete functionality with confirmation modal. | Frontend | 2 | To Do |
| S5 | T5.15 | Landlord UI | Create "Generate Agreement" form with property selection and terms input. | Frontend | 3 | To Do |
| S5 | T5.16 | Landlord UI | Build Agreement Preview & Edit page before sending to tenant. | Frontend | 3 | To Do |
| S5 | T5.17 | Tenant UI | Create "My Agreements" dashboard page with list view and filters. | Frontend | 3 | To Do |
| S5 | T5.18 | Tenant UI | Build E-Signature modal with canvas drawing or typed signature options. | Frontend | 4 | To Do |
| S5 | T5.19 | Common UI | Create Agreement Detail View component (read-only) with download button. | Frontend | 2 | To Do |
| S5 | T5.20 | Testing | Write unit tests for agreement status transitions and validations. | QA/Dev | 2 | To Do |
| S5 | T5.21 | Testing | Perform E2E testing for complete flow: generate → review → sign → download. | QA/Dev | 3 | To Do |
| S5 | T5.22 | Testing | Test PDF integrity and signature verification. | QA/Dev | 2 | To Do |
| S5 | T5.23 | Testing | Conduct permission tests (tenant cannot edit landlord's agreement). | QA/Dev | 1 | To Do |
| S5 | T5.24 | Security Audit | Test for SQL Injection and unauthorized access to agreements. | QA/Dev | 2 | To Do |

---

## SPRINT 6 - RECOMMENDATION ENGINE

### User Stories

| Role | User Story | Acceptance Criteria | Priority | Sprint |
|------|-----------|---------------------|----------|---------|
| Tenant | As a tenant, I want to see recommended properties so that I can discover listings matching my preferences. | 1. Dedicated "Recommended for You" section on dashboard.<br>2. Shows 6-10 listings based on preferences and behavior.<br>3. Recommendations refresh daily with new listings. | Must be | Sprint 6 |
| Tenant | As a tenant, I want recommendations based on my search history so that suggestions are relevant. | 1. System analyzes past searches (location, price range, property type).<br>2. Implicit signals (views, favorites, time spent) weighted in scoring.<br>3. Recommendations improve as more data is collected. | Must be | Sprint 6 |
| Tenant | As a tenant, I want to hide irrelevant recommendations so that future suggestions improve. | 1. "Not Interested" button on each recommended listing.<br>2. Hidden listings excluded from future recommendations.<br>3. Feedback recorded to refine recommendation algorithm. | Should be | Sprint 6 |
| Tenant | As a tenant, I want to understand why a property was recommended so that I trust the suggestions. | 1. "Why this?" tooltip shows matching criteria (e.g., "Matches your budget and preferred location").<br>2. Highlights 2-3 key matching factors.<br>3. Simple, non-technical language. | Should be | Sprint 6 |
| Tenant | As a tenant, I want to receive weekly recommendation emails so that I don't miss new listings. | 1. Personalized email digest with top 5 recommendations.<br>2. Includes new arrivals matching saved preferences.<br>3. Unsubscribe option available in email footer. | Should be | Sprint 6 |
| Admin | As an admin, I want to monitor recommendation performance so that I can measure effectiveness. | 1. Analytics dashboard shows: CTR, saves/favorites, inquiries from recommendations.<br>2. Chart displays weekly trend of recommendation engagement.<br>3. Breakdown by property type and location. | Must be | Sprint 6 |
| Admin | As an admin, I want to pause the recommendation engine so that I can address issues if quality drops. | 1. Toggle switch to enable/disable recommendations globally.<br>2. Status indicator shows "Active" or "Paused".<br>3. Last refresh timestamp displayed. | Must be | Sprint 6 |
| System | As the system, I want to handle cold-start problem so that new users get recommendations immediately. | 1. New users without history get popular listings in their region.<br>2. After first search/view, system switches to personalized mode.<br>3. Fallback to trending properties if insufficient data. | Must be | Sprint 6 |

---

### Sprint Backlog - Sprint 6

| Sprint | Task ID | Feature Category | Task Description | Team | Story Points | Status |
|--------|---------|------------------|------------------|------|--------------|--------|
| S6 | T6.1 | Data Pipeline | Build feature vector pipeline to extract tenant preferences (location, budget, type, amenities). | Backend | 3 | To Do |
| S6 | T6.2 | Data Pipeline | Create behavior signal aggregator (views, favorites, search queries, time spent). | Backend | 4 | To Do |
| S6 | T6.3 | Data Pipeline | Implement nightly cron job to refresh user preference vectors and listing embeddings. | Backend | 3 | To Do |
| S6 | T6.4 | ML Model | Enhance TF-IDF vectorizer for listing descriptions and amenities. | Backend | 4 | To Do |
| S6 | T6.5 | ML Model | Update k-means clustering to group similar properties (use kmeans-cluster.js). | Backend | 4 | To Do |
| S6 | T6.6 | ML Model | Build hybrid scoring function: 60% explicit preferences + 40% implicit signals. | Backend | 5 | To Do |
| S6 | T6.7 | ML Model | Implement cold-start fallback: popular/trending listings for new users. | Backend | 3 | To Do |
| S6 | T6.8 | Recommendation API | Create GET /api/recommendations endpoint with pagination and filters. | Backend | 3 | To Do |
| S6 | T6.9 | Recommendation API | Implement POST /api/recommendations/:id/hide endpoint to record negative feedback. | Backend | 2 | To Do |
| S6 | T6.10 | Recommendation API | Build POST /api/recommendations/:id/flag endpoint for irrelevant/spam listings. | Backend | 2 | To Do |
| S6 | T6.11 | Recommendation API | Create GET /api/recommendations/explain/:id endpoint for "Why this?" tooltips. | Backend | 2 | To Do |
| S6 | T6.12 | Admin API | Build GET /api/admin/recommendations/analytics endpoint with CTR and engagement metrics. | Backend | 3 | To Do |
| S6 | T6.13 | Admin API | Create POST /api/admin/recommendations/toggle endpoint to pause/resume engine. | Backend | 2 | To Do |
| S6 | T6.14 | Notifications | Create personalized weekly digest email template with top 5 recommendations. | Backend | 3 | To Do |
| S6 | T6.15 | Notifications | Build cron scheduler to send weekly digest every Monday at 9 AM. | Backend | 2 | To Do |
| S6 | T6.16 | Tenant UI | Build "Recommended for You" carousel on tenant dashboard. | Frontend | 4 | To Do |
| S6 | T6.17 | Tenant UI | Implement "Not Interested" button with smooth removal animation. | Frontend | 2 | To Do |
| S6 | T6.18 | Tenant UI | Create "Why this?" tooltip with matching criteria display. | Frontend | 2 | To Do |
| S6 | T6.19 | Tenant UI | Add loading skeleton and empty state ("Check back tomorrow for new recommendations"). | Frontend | 2 | To Do |
| S6 | T6.20 | Admin UI | Build Recommendation Analytics Dashboard with charts (CTR, engagement, trends). | Frontend | 5 | To Do |
| S6 | T6.21 | Admin UI | Implement pause/resume toggle with confirmation modal. | Frontend | 2 | To Do |
| S6 | T6.22 | Admin UI | Display last refresh timestamp and engine status indicator. | Frontend | 1 | To Do |
| S6 | T6.23 | Performance | Optimize recommendation query to achieve P95 latency < 500ms. | Backend | 3 | To Do |
| S6 | T6.24 | Performance | Implement Redis caching for recommendation results (24-hour TTL). | Backend | 3 | To Do |
| S6 | T6.25 | Testing | Write unit tests for scoring function and feature vector generation. | QA/Dev | 2 | To Do |
| S6 | T6.26 | Testing | Perform relevance smoke tests: verify recommendations match user preferences. | QA/Dev | 3 | To Do |
| S6 | T6.27 | Testing | Test feedback loop: verify hidden listings excluded from future recommendations. | QA/Dev | 2 | To Do |
| S6 | T6.28 | Testing | Validate cold-start behavior for new users with no history. | QA/Dev | 2 | To Do |
| S6 | T6.29 | Testing | Test API performance under load (100 concurrent users). | QA/Dev | 2 | To Do |
| S6 | T6.30 | Testing | Verify analytics accuracy by comparing with actual engagement data. | QA/Dev | 2 | To Do |

---

## SPRINT TIMELINE

| Sprint | Start Date | End Date | Duration | Focus Area |
|--------|------------|----------|----------|------------|
| Sprint 5 | 2025/11/25 | 2025/12/22 | 4 weeks | Rent Agreement Module |
| Sprint 6 | 2025/12/23 | 2026/01/20 | 4 weeks | Recommendation Engine |

---

## DEFINITION OF DONE

### Sprint 5 - Rent Agreement
- [ ] All user stories completed and acceptance criteria met
- [ ] PDF generation working with correct formatting and data
- [ ] E-signature functionality tested and secure
- [ ] Agreement status workflow validated
- [ ] Audit trail logging all actions correctly
- [ ] Email notifications delivered successfully
- [ ] Admin panel functional with search and soft-delete
- [ ] Code reviewed and merged to main branch
- [ ] Unit test coverage > 80%
- [ ] E2E tests passing for complete flow
- [ ] Security audit completed (SQL Injection, Access Control)
- [ ] Documentation updated (API endpoints, workflow diagram)

### Sprint 6 - Recommendation Engine
- [ ] All user stories completed and acceptance criteria met
- [ ] Recommendation algorithm producing relevant results
- [ ] Cold-start fallback working for new users
- [ ] Feedback loop (hide/flag) affecting future recommendations
- [ ] API response time < 500ms (P95)
- [ ] Admin analytics dashboard showing accurate metrics
- [ ] Weekly email digest scheduler working
- [ ] "Why this?" explanations displaying correctly
- [ ] Code reviewed and merged to main branch
- [ ] Unit test coverage > 80%
- [ ] Relevance testing validated by QA
- [ ] Performance testing passed (100 concurrent users)
- [ ] Redis caching implemented and tested
- [ ] Documentation updated (algorithm logic, API endpoints)

---

## DEPENDENCIES & RISKS

### Sprint 5 Dependencies
- RentAgreement model already exists in codebase
- pdf.js utility available for PDF generation
- email-service.js ready for notifications
- audit-logger.js available for tracking

### Sprint 5 Risks
- **Risk:** E-signature legal compliance may require third-party service
  - **Mitigation:** Research legal requirements early; consider DocuSign/Adobe Sign integration if needed
- **Risk:** PDF generation may fail with complex terms
  - **Mitigation:** Create standardized template with validation for edge cases

### Sprint 6 Dependencies
- ml-recommendation-service.js already exists
- tfidf-vectorizer.js and kmeans-cluster.js available
- SearchHistory, UserPreferences, UserSearchPreferences models ready
- ListingView model tracks user behavior

### Sprint 6 Risks
- **Risk:** Recommendation quality may be poor initially with limited data
  - **Mitigation:** Start with cold-start fallback; improve as data accumulates
- **Risk:** Performance degradation with large user base
  - **Mitigation:** Implement Redis caching and optimize queries early
- **Risk:** Email digest may be marked as spam
  - **Mitigation:** Configure SPF/DKIM records; include clear unsubscribe option

---

## NOTES
- Both sprints align with existing system architecture
- Backend uses Node.js/Express with MongoDB (Mongoose models)
- ML services already have foundation components (TF-IDF, k-means)
- Notification service supports email and real-time push
- Admin analytics service can be extended for recommendation metrics
- Socket service available for real-time agreement status updates
