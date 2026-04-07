-- === References to profiles (old profile_id: d8281da7-940a-4003-99f9-c3db2d94fbd8 → new: abf9e431-b5bd-4d6b-a49e-e0b60691f20e) ===
UPDATE fault_cases SET assigned_to = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE assigned_to = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
UPDATE fault_cases SET created_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE created_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE fault_comments SET user_id = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE user_id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE fault_attachments SET uploaded_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE uploaded_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE logbook_crew SET profile_id = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE profile_id = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
UPDATE logbook_signatures SET signed_by = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE signed_by = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
UPDATE booking_crew SET profile_id = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE profile_id = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
UPDATE user_certificates SET profile_id = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE profile_id = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
UPDATE user_vessel_inductions SET profile_id = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE profile_id = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
UPDATE control_point_records SET performed_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE performed_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE control_point_attachments SET uploaded_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE uploaded_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE deviations SET created_by = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE created_by = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
UPDATE deviation_actions SET created_by = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE created_by = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
UPDATE deviation_responses SET responded_by = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE responded_by = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
UPDATE deviation_attachments SET uploaded_by = 'abf9e431-b5bd-4d6b-a49e-e0b60691f20e' WHERE uploaded_by = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';

-- === References to auth.users (old user_id: 91c52f98 → new: e488e459) ===
UPDATE logbooks SET created_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE created_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE logbooks SET closed_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE closed_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE checklist_executions SET started_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE started_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE checklist_step_results SET confirmed_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE confirmed_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE booking_pms SET created_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE created_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE bookings SET created_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE created_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE intranet_messages SET created_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE created_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE intranet_documents SET uploaded_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE uploaded_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE bunker_events SET recorded_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE recorded_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE audit_logs SET user_id = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE user_id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE page_views SET user_id = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE user_id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE booking_audit_logs SET user_id = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE user_id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE vessel_certificates SET created_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE created_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE notification_logs SET user_id = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE user_id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
UPDATE changelog SET created_by = 'e488e459-2370-46c0-b303-7b86b10538d4' WHERE created_by = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';

-- === Clean up membership/roles/superadmin ===
DELETE FROM superadmins WHERE user_id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
DELETE FROM user_roles WHERE user_id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';
DELETE FROM organization_members WHERE user_id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';

-- === Delete profile then auth user ===
DELETE FROM profiles WHERE id = 'd8281da7-940a-4003-99f9-c3db2d94fbd8';
DELETE FROM auth.users WHERE id = '91c52f98-1bfd-45fc-8590-eb21f08bbdec';