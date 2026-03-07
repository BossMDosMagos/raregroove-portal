Checklist RLS - Producao
========================

Objective
---------
Ensure Row Level Security (RLS) is enabled and policies protect sensitive data before production.

Pre-checks
----------
- Confirm .env points to the correct Supabase project
- Confirm you are connected to the production database in Supabase SQL Editor

1) RLS Enabled (Tables)
-----------------------
Run in Supabase SQL Editor:

SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN (
  'profiles','items','messages','conversations','transactions',
  'reviews','wishlist','notifications','withdrawals'
);

Expected
--------
- All rows show relrowsecurity = true
- If any are false, enable:
  ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

2) Policy Coverage (By Table)
-----------------------------

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'profiles','items','messages','conversations','transactions',
  'reviews','wishlist','notifications','withdrawals'
)
ORDER BY tablename, policyname;

Expected
--------
- Each table has SELECT policies for allowed users
- Each table has INSERT/UPDATE policies where applicable

3) Transactions Tracking Policies
---------------------------------

SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'transactions'
ORDER BY policyname;

Expected
--------
- Seller can update tracking_code
- Buyer can read tracking_code

4) Profiles Sensitive Fields
----------------------------

-- Verify only owner can see full profile
-- Run as user A and ensure user B data is not visible
SELECT *
FROM profiles
WHERE id != auth.uid();

Expected
--------
- No rows returned (or only public-safe fields if a separate policy exists)

5) Notifications and Wishlist
-----------------------------

-- As user A, ensure you cannot read user B notifications
SELECT *
FROM notifications
WHERE user_id != auth.uid();

Expected
--------
- No rows returned

6) Storage Policies (Avatars)
-----------------------------

Check bucket policies in Supabase Storage:
- Bucket: avatars
- Public read allowed
- Insert/update allowed only for owner folder

7) Regression Tests (UI)
------------------------
- Login as buyer: can read own purchases and tracking
- Login as seller: can update tracking on paid orders
- Login as other user: cannot access foreign transactions

Sign-off
--------
- Date:
- Verified by:
- Notes:
