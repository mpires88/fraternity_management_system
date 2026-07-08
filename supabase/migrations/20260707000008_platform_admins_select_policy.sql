-- Allow authenticated users to check if they are a platform admin
create policy "platform_admins_select"
  on platform_admins for select
  using (id = (select auth.uid()));
