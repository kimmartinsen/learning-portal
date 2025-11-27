-- ============================================================================
-- OPPRETT INVITASJONSSYSTEM
-- ============================================================================
-- Admin kan invitere brukere som oppretter sin egen konto ved første innlogging
-- ============================================================================

-- 1. OPPRETT INVITATIONS TABELL
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'user')),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. OPPRETT INVITATION_DEPARTMENTS TABELL (mange-til-mange)
CREATE TABLE IF NOT EXISTS invitation_departments (
  invitation_id UUID REFERENCES invitations(id) ON DELETE CASCADE NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (invitation_id, department_id)
);

-- 3. INDEKSER
CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitation_departments_invitation ON invitation_departments(invitation_id);
CREATE INDEX IF NOT EXISTS idx_invitation_departments_department ON invitation_departments(department_id);

-- 4. ROW LEVEL SECURITY
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_departments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invitations
CREATE POLICY "Users view their own invitations" ON invitations FOR SELECT 
  USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
    OR company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins manage invitations" ON invitations FOR ALL 
  USING (
    company_id IN (
      SELECT company_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for invitation_departments
CREATE POLICY "Users view invitation departments" ON invitation_departments FOR SELECT 
  USING (
    invitation_id IN (
      SELECT id FROM invitations 
      WHERE email = (SELECT email FROM profiles WHERE id = auth.uid())
      OR company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Admins manage invitation departments" ON invitation_departments FOR ALL 
  USING (
    invitation_id IN (
      SELECT id FROM invitations 
      WHERE company_id IN (
        SELECT company_id FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- 5. TRIGGER FOR AUTO-UPDATE updated_at
CREATE OR REPLACE FUNCTION update_invitation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invitation_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_invitation_updated_at();

-- 6. FUNKSJON FOR Å OPPRETTE INVITASJON
CREATE OR REPLACE FUNCTION create_invitation(
  p_company_id UUID,
  p_email VARCHAR,
  p_full_name VARCHAR,
  p_role VARCHAR,
  p_invited_by UUID,
  p_department_ids UUID[] DEFAULT ARRAY[]::UUID[]
) RETURNS UUID AS $$
DECLARE
  v_invitation_id UUID;
  v_token VARCHAR;
  v_dept_id UUID;
BEGIN
  -- Generer unik token
  v_token := encode(gen_random_bytes(32), 'base64');
  
  -- Opprett invitasjon
  INSERT INTO invitations (
    company_id,
    email,
    full_name,
    role,
    invited_by,
    token,
    expires_at
  ) VALUES (
    p_company_id,
    p_email,
    p_full_name,
    p_role,
    p_invited_by,
    v_token,
    NOW() + INTERVAL '30 days' -- Invitasjon utløper om 30 dager
  ) RETURNING id INTO v_invitation_id;
  
  -- Legg til avdelinger
  IF array_length(p_department_ids, 1) > 0 THEN
    FOREACH v_dept_id IN ARRAY p_department_ids
    LOOP
      INSERT INTO invitation_departments (invitation_id, department_id)
      VALUES (v_invitation_id, v_dept_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  
  RETURN v_invitation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FERDIG! ✅
-- ============================================================================
-- Nå har du:
-- 1. invitations tabell for å lagre invitasjoner
-- 2. invitation_departments for å lagre flere avdelinger per invitasjon
-- 3. RLS policies for sikkerhet
-- 4. Funksjon for å opprette invitasjoner
-- ============================================================================

