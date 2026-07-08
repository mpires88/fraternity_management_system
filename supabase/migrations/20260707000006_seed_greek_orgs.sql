-- Seed parent_organizations with major Greek organizations
-- and set Sigma Nu's branding colors

-- Update existing Sigma Nu row
UPDATE parent_organizations
SET primary_color = '#000000', secondary_color = '#C4A747'
WHERE slug = 'sigma-nu';

-- NIC Fraternities
INSERT INTO parent_organizations (id, name, abbreviation, slug, org_type, founded_year, primary_color, secondary_color, status)
VALUES
  (gen_random_uuid(), 'Sigma Chi', 'ΣΧ', 'sigma-chi', 'fraternity', 1855, '#003087', '#D4AF37', 'active'),
  (gen_random_uuid(), 'Sigma Alpha Epsilon', 'ΣΑΕ', 'sigma-alpha-epsilon', 'fraternity', 1856, '#6F2C91', '#C5A94C', 'active'),
  (gen_random_uuid(), 'Kappa Sigma', 'ΚΣ', 'kappa-sigma', 'fraternity', 1869, '#9B1B30', '#004225', 'active'),
  (gen_random_uuid(), 'Pi Kappa Alpha', 'ΠΚΑ', 'pi-kappa-alpha', 'fraternity', 1868, '#6C2D40', '#C5A94C', 'active'),
  (gen_random_uuid(), 'Beta Theta Pi', 'ΒΘΠ', 'beta-theta-pi', 'fraternity', 1839, '#4E2A84', '#E8B4B8', 'active'),
  (gen_random_uuid(), 'Phi Delta Theta', 'ΦΔΘ', 'phi-delta-theta', 'fraternity', 1848, '#003DA5', '#FFFFFF', 'active'),
  (gen_random_uuid(), 'Alpha Tau Omega', 'ΑΤΩ', 'alpha-tau-omega', 'fraternity', 1865, '#0055A4', '#C5A94C', 'active'),
  (gen_random_uuid(), 'Lambda Chi Alpha', 'ΛΧΑ', 'lambda-chi-alpha', 'fraternity', 1909, '#4B2E83', '#C5A94C', 'active'),
  (gen_random_uuid(), 'Theta Chi', 'ΘΧ', 'theta-chi', 'fraternity', 1856, '#8B0000', '#FFFFFF', 'active'),
  (gen_random_uuid(), 'Delta Tau Delta', 'ΔΤΔ', 'delta-tau-delta', 'fraternity', 1858, '#4B0082', '#C5A94C', 'active'),
  (gen_random_uuid(), 'Phi Gamma Delta', 'ΦΓΔ', 'phi-gamma-delta', 'fraternity', 1848, '#4169E1', '#FFFFFF', 'active'),
  (gen_random_uuid(), 'Tau Kappa Epsilon', 'ΤΚΕ', 'tau-kappa-epsilon', 'fraternity', 1899, '#DC143C', '#808080', 'active')
ON CONFLICT (slug) DO NOTHING;

-- NPC Sororities
INSERT INTO parent_organizations (id, name, abbreviation, slug, org_type, founded_year, primary_color, secondary_color, status)
VALUES
  (gen_random_uuid(), 'Alpha Phi', 'ΑΦ', 'alpha-phi', 'sorority', 1872, '#800020', '#C0C0C0', 'active'),
  (gen_random_uuid(), 'Kappa Kappa Gamma', 'ΚΚΓ', 'kappa-kappa-gamma', 'sorority', 1870, '#003087', '#87CEEB', 'active'),
  (gen_random_uuid(), 'Delta Delta Delta', 'ΔΔΔ', 'delta-delta-delta', 'sorority', 1888, '#003087', '#C0C0C0', 'active'),
  (gen_random_uuid(), 'Chi Omega', 'ΧΩ', 'chi-omega', 'sorority', 1895, '#CC0033', '#FFE4B5', 'active'),
  (gen_random_uuid(), 'Pi Beta Phi', 'ΠΒΦ', 'pi-beta-phi', 'sorority', 1867, '#8B0000', '#C0C0C0', 'active'),
  (gen_random_uuid(), 'Kappa Alpha Theta', 'ΚΑΘ', 'kappa-alpha-theta', 'sorority', 1870, '#000000', '#C5A94C', 'active'),
  (gen_random_uuid(), 'Alpha Chi Omega', 'ΑΧΩ', 'alpha-chi-omega', 'sorority', 1885, '#9B111E', '#004F2D', 'active')
ON CONFLICT (slug) DO NOTHING;

-- NPHC Organizations
INSERT INTO parent_organizations (id, name, abbreviation, slug, org_type, founded_year, primary_color, secondary_color, status)
VALUES
  (gen_random_uuid(), 'Alpha Phi Alpha', 'ΑΦΑ', 'alpha-phi-alpha', 'fraternity', 1906, '#000000', '#C5A94C', 'active'),
  (gen_random_uuid(), 'Kappa Alpha Psi', 'ΚΑΨ', 'kappa-alpha-psi', 'fraternity', 1911, '#8B0000', '#F5F5DC', 'active'),
  (gen_random_uuid(), 'Omega Psi Phi', 'ΩΨΦ', 'omega-psi-phi', 'fraternity', 1911, '#4B0082', '#C5A94C', 'active'),
  (gen_random_uuid(), 'Delta Sigma Theta', 'ΔΣΘ', 'delta-sigma-theta', 'sorority', 1913, '#8B0000', '#FFFFFF', 'active'),
  (gen_random_uuid(), 'Alpha Kappa Alpha', 'ΑΚΑ', 'alpha-kappa-alpha', 'sorority', 1908, '#E75480', '#004225', 'active')
ON CONFLICT (slug) DO NOTHING;

-- NALFO Organizations
INSERT INTO parent_organizations (id, name, abbreviation, slug, org_type, founded_year, primary_color, secondary_color, status)
VALUES
  (gen_random_uuid(), 'Lambda Theta Alpha', 'ΛΘΑ', 'lambda-theta-alpha', 'sorority', 1975, '#8B4513', '#C5A94C', 'active'),
  (gen_random_uuid(), 'Sigma Lambda Beta', 'ΣΛΒ', 'sigma-lambda-beta', 'fraternity', 1986, '#4B0082', '#FFFFFF', 'active')
ON CONFLICT (slug) DO NOTHING;
