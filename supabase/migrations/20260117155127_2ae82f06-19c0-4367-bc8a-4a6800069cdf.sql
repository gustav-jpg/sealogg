-- Make attachments bucket public so stored public URLs can be displayed in the app
update storage.buckets
set public = true
where id = 'attachments';

-- Storage policies for attachments bucket
-- Allow authenticated users to upload files
create policy "Authenticated users can upload attachments"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'attachments');

-- Allow authenticated users to view attachments
create policy "Authenticated users can read attachments"
on storage.objects
for select
to authenticated
using (bucket_id = 'attachments');

-- Allow owners to update their own objects
create policy "Owners can update their attachments"
on storage.objects
for update
to authenticated
using (bucket_id = 'attachments' and owner = auth.uid())
with check (bucket_id = 'attachments' and owner = auth.uid());

-- Allow owners to delete their own objects
create policy "Owners can delete their attachments"
on storage.objects
for delete
to authenticated
using (bucket_id = 'attachments' and owner = auth.uid());