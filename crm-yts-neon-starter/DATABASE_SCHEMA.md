# Database Schema — CRM YTS

## Konvensi
- Primary key: UUID.
- Timestamp: `timestamptz`.
- Uang: `bigint` dalam satuan rupiah, bukan floating point.
- Semua tabel utama memiliki `created_at`, `updated_at`.
- `created_by` / `updated_by` ditambahkan pada tabel yang membutuhkan audit operasional.
- Hard delete dibatasi. Data historis penting menggunakan status/soft delete bila relevan.

## 1. Identity & Authorization

### app_users
Menghubungkan identity provider dengan user CRM.
- id uuid PK
- auth_subject text UNIQUE NOT NULL
- email text UNIQUE NOT NULL
- full_name text NOT NULL
- is_active boolean default true
- last_login_at timestamptz nullable
- created_at
- updated_at

### roles
- id uuid PK
- code text UNIQUE
- name text
- description text
- is_system boolean

### permissions
- id uuid PK
- code text UNIQUE
- resource text
- action text
- description text

### user_roles
- user_id FK app_users
- role_id FK roles
- UNIQUE(user_id, role_id)

### role_permissions
- role_id
- permission_id
- UNIQUE(role_id, permission_id)

## 2. People

### persons
- id
- full_name
- phone_e164 nullable
- email nullable
- gender nullable
- country_code nullable
- province nullable
- city_regency nullable
- district nullable
- occupation nullable
- education_level nullable
- source_code nullable
- engagement_status nullable
- preferred_channel nullable
- owner_user_id nullable
- is_active boolean
- created_at
- updated_at

Indexes:
- phone_e164
- lower(full_name)
- owner_user_id
- engagement_status

### person_roles
Contoh: jamaah, donor, waqif, volunteer.
- person_id
- role_code
- assigned_at
- UNIQUE(person_id, role_code)

### tags
- id
- name
- category
- is_active

### person_tags
- person_id
- tag_id

### sensitive_notes
- id
- person_id
- note_text
- sensitivity_level
- reason
- expires_at nullable
- created_by
- created_at
- deleted_at nullable

## 3. Kajian

### events
- id
- title
- category
- speaker
- start_at
- end_at nullable
- delivery_mode
- location_name nullable
- meeting_url nullable
- status
- created_by

### event_attendance
- id
- event_id
- person_id
- check_in_at
- source
- status
- UNIQUE(event_id, person_id)

## 4. Interaction & Task

### interactions
- id
- person_id
- channel
- summary
- outcome
- sensitivity_level
- owner_user_id
- occurred_at
- created_by

### tasks
- id
- person_id nullable
- related_type nullable
- related_id nullable
- title
- description nullable
- status
- priority
- due_at
- owner_user_id
- assigned_by
- completed_at nullable
- created_at
- updated_at

## 5. Donation

### donation_programs
- id
- name
- code UNIQUE
- is_active

### donations
- id
- person_id nullable
- program_id
- donation_date
- amount_rupiah bigint
- payment_method
- external_reference nullable
- verification_status
- proof_attachment_id nullable
- verified_by nullable
- verified_at nullable
- rejection_reason nullable
- correction_of_donation_id nullable
- created_by
- created_at
- updated_at

Critical indexes:
- donation_date
- verification_status
- person_id
- program_id
- external_reference

## 6. Wakaf

### waqf_cases
- id
- person_id
- waqf_type
- estimated_value_rupiah bigint nullable
- current_stage
- owner_user_id
- opened_at
- completed_at nullable
- next_action_at nullable
- notes_summary nullable
- created_by
- updated_at

### waqf_stage_history
- id
- waqf_case_id
- from_stage nullable
- to_stage
- reason nullable
- changed_by
- changed_at

### waqf_checklist_items
- id
- waqf_case_id
- item_code
- label
- is_required
- is_completed
- completed_by nullable
- completed_at nullable

### waqf_documents
- id
- waqf_case_id
- attachment_id
- document_type
- version_no
- is_sensitive
- uploaded_by

## 7. Attachments

### attachments
- id
- storage_provider
- bucket
- object_key
- original_filename
- mime_type
- file_size
- checksum nullable
- sensitivity_level
- uploaded_by
- created_at
- deleted_at nullable

## 8. Audit

### audit_logs
- id
- actor_user_id nullable
- action
- entity_type
- entity_id nullable
- before_json jsonb nullable
- after_json jsonb nullable
- reason nullable
- request_id nullable
- ip_hash nullable
- user_agent_summary nullable
- created_at

### export_logs
- id
- actor_user_id
- export_type
- filter_json
- row_count
- reason
- file_reference nullable
- expires_at nullable
- created_at

## 9. Views
Direkomendasikan:
- `v_dashboard_jamaah_summary`
- `v_dashboard_followup_summary`
- `v_dashboard_donation_monthly`
- `v_dashboard_waqf_pipeline`
- `v_event_attendance_summary`
- `v_person_journey_summary`
- `v_data_quality_summary`

## 10. Database Functions
Direkomendasikan:
- `calculate_engagement_status(person_id)`
- `transition_waqf_stage(...)`
- `verify_donation(...)`
- `correct_verified_donation(...)`
- `merge_persons(...)`
- `reassign_owner(...)`

Semua function sensitif harus diaudit dan tidak boleh callable secara bebas tanpa permission.
