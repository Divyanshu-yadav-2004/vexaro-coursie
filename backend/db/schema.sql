-- ============================================================
-- Vexaro KYC — PostgreSQL Schema
-- Run this file once to create all tables
-- ============================================================

-- Drop tables in correct order (FK constraints)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS kyc_records CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ─── USERS TABLE ─────────────────────────────────────────────
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(150),
  first_name      VARCHAR(75),
  last_name       VARCHAR(75),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  mobile          VARCHAR(20),
  role            VARCHAR(20) NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin', 'owner')),
  gender          VARCHAR(10) DEFAULT 'male',
  agency_name     VARCHAR(200),
  address_line1   VARCHAR(255),
  address_line2   VARCHAR(255),
  city            VARCHAR(100),
  state           VARCHAR(100),
  pincode         VARCHAR(20),
  billing_address_line1 VARCHAR(255),
  billing_address_line2 VARCHAR(255),
  same_as_permanent BOOLEAN DEFAULT TRUE,
  profile_photo   TEXT, -- TEXT supports large base64 strings
  kyc_status      VARCHAR(20) NOT NULL DEFAULT 'not_started'
                  CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected')),
  
  -- Additional prototype fields
  aadhar_num      VARCHAR(20),
  pan_num         VARCHAR(20),
  bank_name       VARCHAR(150),
  bill_landmark   VARCHAR(255),
  bill_city       VARCHAR(100),
  bill_state      VARCHAR(100),
  bill_pincode    VARCHAR(20),
  amazon_tag      VARCHAR(50) DEFAULT 'na',
  is_active       BOOLEAN DEFAULT TRUE,
  is_blocked      BOOLEAN DEFAULT FALSE,
  password_reset  BOOLEAN DEFAULT FALSE,
  created_by      VARCHAR(100) DEFAULT 'superadmin',
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── KYC RECORDS TABLE ───────────────────────────────────────
CREATE TABLE kyc_records (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  aadhaar_front_path  VARCHAR(500),
  aadhaar_front_name  VARCHAR(255),
  aadhaar_front_size  VARCHAR(50),
  aadhaar_back_path   VARCHAR(500),
  aadhaar_back_name   VARCHAR(255),
  aadhaar_back_size   VARCHAR(50),
  pan_card_path       VARCHAR(500),
  pan_card_name       VARCHAR(255),
  pan_card_size       VARCHAR(50),
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason    TEXT,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         INTEGER REFERENCES users(id),
  
  -- Additional Base64 columns
  aadhaar_front_data  TEXT,
  aadhaar_back_data   TEXT,
  pan_card_data       TEXT,
  
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── ACTIVITY LOGS TABLE ─────────────────────────────────────
CREATE TABLE activity_logs (
  id          SERIAL PRIMARY KEY,
  user_id     VARCHAR(50),
  user_name   VARCHAR(150),
  action      TEXT,
  timestamp   BIGINT,
  details     TEXT,
  icon        VARCHAR(10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_kyc_user_id ON kyc_records(user_id);
CREATE INDEX idx_kyc_status ON kyc_records(status);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);

-- ─── TRIGGER: auto-update updated_at on users ────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── TRIGGER: auto-update updated_at on kyc_records ──────────
CREATE TRIGGER kyc_records_updated_at
  BEFORE UPDATE ON kyc_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SEED: Initial Seed Data ─────────────────────────────────
-- Passwords are bcrypt hashes of: admin@kyc123 and owner@kyc123
INSERT INTO users (name, first_name, last_name, email, password_hash, mobile, role, kyc_status, gender, agency_name, address_line1, address_line2, city, state, pincode, billing_address_line1, billing_address_line2, same_as_permanent, aadhar_num, pan_num, bank_name, bill_landmark, bill_city, bill_state, bill_pincode, amazon_tag, is_active, is_blocked, password_reset, created_by)
VALUES
  (
    'System Admin', 'System', 'Admin', 'admin@kycportal.com',
    '$2a$10$IKsCmNnGnJ51J2IAYYEHyOYe7F81iYIRBk/Gv1VfvS.UE3jLcVpO6',
    '9999999999', 'admin', 'approved', 'male', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'na', TRUE, FALSE, FALSE, 'system'
  ),
  (
    'Senior Partner', 'Senior', 'Partner', 'owner@kycportal.com',
    '$2a$10$p7xh.4hWsmYPJR5hRJsqu.F7A7E9alK1dl/mdCeOu9h3xYXmYU9mC',
    '8888888888', 'owner', 'approved', 'male', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'na', TRUE, FALSE, FALSE, 'system'
  ),
  (
    'Rahul Sharma', 'Rahul', 'Sharma', 'rahul@example.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '9876543210', 'user', 'pending', 'male', 'Vexaro Courier and Cargo',
    '12 MG Road', 'Near High School', 'Mumbai', 'Maharashtra', '400001',
    '12 MG Road', 'Near High School', TRUE, '592810483920', 'ABCDE1234F', 'State Bank of India', 'Opposite Police Station', 'Mumbai', 'Maharashtra', '400001', 'na', TRUE, FALSE, FALSE, 'superadmin'
  ),
  (
    'Priya Patel', 'Priya', 'Patel', 'priya@example.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '9845678901', 'user', 'approved', 'female', 'Velocity Logistics',
    '45 Nehru Nagar', 'Sector 4', 'Ahmedabad', 'Gujarat', '380001',
    '45 Nehru Nagar', 'Sector 4', TRUE, '918204938201', 'XYZPQ5678A', 'HDFC Bank', 'Opposite Garden', 'Ahmedabad', 'Gujarat', '380001', 'vlc101', TRUE, FALSE, FALSE, 'superadmin'
  ),
  (
    'Amit Kumar', 'Amit', 'Kumar', 'amit@example.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '9712345678', 'user', 'rejected', 'male', 'Raza Courier And Cargo',
    '7 Civil Lines', 'Mall Road', 'New Delhi', 'Delhi', '110001',
    '7 Civil Lines', 'Mall Road', TRUE, '782910384910', 'LMNOP2468B', 'ICICI Bank', 'Near City Metro', 'New Delhi', 'Delhi', '110001', 'na', TRUE, FALSE, FALSE, 'superadmin'
  ),
  (
    'Sneha Reddy', 'Sneha', 'Reddy', 'sneha@example.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '9988776655', 'user', 'pending', 'female', 'Vexaro Courier and Cargo',
    '23 Jubilee Hills', 'Road No 3', 'Hyderabad', 'Telangana', '500033',
    '23 Jubilee Hills', 'Road No 3', TRUE, '381920394810', 'QRSRT9876C', 'Axis Bank', 'Opposite Cafe', 'Hyderabad', 'Telangana', '500033', 'na', TRUE, FALSE, FALSE, 'superadmin'
  ),
  (
    'Vikram Singh', 'Vikram', 'Singh', 'vikram@example.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '9611223344', 'user', 'not_started', 'male', 'Vexaro Courier and Cargo',
    '56 Park Street', 'Floor 3', 'Kolkata', 'West Bengal', '700016',
    '56 Park Street', 'Floor 3', TRUE, '482910384912', 'UVWXY1357D', 'Punjab National Bank', 'Next to Museum', 'Kolkata', 'West Bengal', '700016', 'na', TRUE, FALSE, FALSE, 'superadmin'
  )
ON CONFLICT (email) DO NOTHING;

-- Seed KYC records
INSERT INTO kyc_records (user_id, aadhaar_front_name, aadhaar_front_size, aadhaar_back_name, aadhaar_back_size, pan_card_name, pan_card_size, status, rejection_reason)
VALUES
  (
    (SELECT id FROM users WHERE email = 'rahul@example.com'),
    'aadhaar_front.png', '420 KB', 'aadhaar_back.png', '390 KB', 'pan_card.png', '310 KB', 'pending', NULL
  ),
  (
    (SELECT id FROM users WHERE email = 'priya@example.com'),
    'aadhaar_front.png', '510 KB', 'aadhaar_back.png', '480 KB', 'pan_card.png', '340 KB', 'approved', NULL
  ),
  (
    (SELECT id FROM users WHERE email = 'amit@example.com'),
    'aadhaar_front.png', '450 KB', 'aadhaar_back.png', '410 KB', 'pan_card.png', '290 KB', 'rejected', 'PAN card image is blurry and unreadable. Please upload a clear, high-resolution image.'
  ),
  (
    (SELECT id FROM users WHERE email = 'sneha@example.com'),
    'aadhaar_front.png', '380 KB', 'aadhaar_back.png', '350 KB', 'pan_card.png', '280 KB', 'pending', NULL
  )
ON CONFLICT (user_id) DO NOTHING;

-- Seed Activity Logs
INSERT INTO activity_logs (user_id, user_name, action, timestamp, details, icon)
VALUES
  ('u1', 'Rahul Sharma', 'Submitted KYC for verification', 1783609200000, '{}', '📤'),
  ('u1', 'Rahul Sharma', 'Uploaded PAN Card', 1783609100000, '{}', '💳'),
  ('u1', 'Rahul Sharma', 'Uploaded Aadhaar Back', 1783609000000, '{}', '📋'),
  ('u1', 'Rahul Sharma', 'Uploaded Aadhaar Front', 1783608900000, '{}', '📋'),
  ('u1', 'Rahul Sharma', 'Created profile', 1783522800000, '{}', '👤'),
  ('u2', 'Priya Patel', 'KYC Approved by Admin', 1783782000000, '{}', '✅'),
  ('u2', 'Priya Patel', 'Submitted KYC for verification', 1783609200000, '{}', '📤'),
  ('u3', 'Amit Kumar', 'KYC Rejected by Admin', 1784041200000, '{"reason": "PAN image blurry"}', '❌'),
  ('u3', 'Amit Kumar', 'Submitted KYC for verification', 1783868400000, '{}', '📤'),
  ('u4', 'Sneha Reddy', 'Submitted KYC for verification', 1783868400000, '{}', '📤');
