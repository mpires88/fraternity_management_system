-- Add branding columns to parent_organizations
ALTER TABLE parent_organizations
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text;

-- Platform admins can update parent org branding
CREATE POLICY "parent_organizations_update" ON parent_organizations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid())
  );

CREATE POLICY "parent_organizations_insert" ON parent_organizations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM platform_admins WHERE id = auth.uid())
  );
