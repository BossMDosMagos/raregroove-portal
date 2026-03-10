RareGroove
===========

Marketplace for rare CDs with escrow flow, chat, reviews, wishlist, finance, and logistics tracking.

Key Features (A to Z)
---------------------
- Auth and profiles: sign up, login, profile edit, avatar upload, public profile card
- Catalog and items: search, filter, item details, list item, manage inventory
- Chat and messages: real-time chat, unread counters, anti-spam and content sanitization
- Wishlist: add/remove wishes, public wishlist, reminders
- Reviews: rating modal, review stats, seller reputation
- Transactions: escrow flow, status lifecycle, buyer/seller views
- Finance: receivables, purchases, withdrawals, dashboard metrics
- Logistics tracking: tracking code, shipment timestamps, delivery confirmation
- Notifications: bell, real-time updates, transaction status events
- Security: RLS policies, protected routes, profile data shielding
- 404 custom page: RareGroove themed error page

Routes
------
- /portal
- /catalogo
- /item/:id
- /meu-acervo
- /mensagens
- /chat/:itemId
- /profile
- * (NotFound)

Core Services
-------------
- Supabase client: src/lib/supabase.js
- Profile service: src/utils/profileService.js
- Message sanitization: src/utils/sanitizeMessage.js

Catalog Image Performance
-------------------------
- CD covers use lazy loading with async decoding and low fetch priority

Setup
-----
1. Install dependencies:
	npm install
2. Create .env:
	VITE_SUPABASE_URL=your_supabase_url
	VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
3. Start dev server:
	npm run dev

Scripts
-------
- npm run dev
- npm run build
- npm run preview

Database and SQL
----------------
- docs/sql/SQL-Create-Profiles-Table.sql
- docs/sql/SQL-Create-Transactions-Table.sql
- docs/sql/SQL-Create-Reviews-Table.sql
- docs/sql/SQL-Create-Wishlist-Notifications.sql
- docs/sql/SQL-Create-Financial-Dashboard.sql
- docs/sql/SQL-Setup-Avatars-Storage.sql
- docs/sql/SQL-Logistica-Rastreio.sql
- docs/sql/SQL-RLS-Policies-LIMPO.sql

Production Checklist (RLS)
--------------------------
Run these in Supabase to verify RLS is enabled and policies are active:

1) Check RLS enabled:
	SELECT relname, relrowsecurity
	FROM pg_class
	WHERE relname IN (
	  'profiles','items','messages','conversations','transactions',
	  'reviews','wishlist','notifications'
	);

2) List policies by table:
	SELECT tablename, policyname, cmd
	FROM pg_policies
	WHERE tablename IN (
	  'profiles','items','messages','conversations','transactions',
	  'reviews','wishlist','notifications'
	)
	ORDER BY tablename, policyname;

3) Spot check transactions tracking policies:
	SELECT policyname, cmd
	FROM pg_policies
	WHERE tablename = 'transactions'
	ORDER BY policyname;

If any table returns relrowsecurity = false, enable it:
	ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

Notes
-----
- NotFound page: src/pages/NotFound.jsx
- Catalog item card: src/components/ItemCard.jsx
- Finance and logistics UI: src/components/FinancialComponents.jsx
- Delivery timeline: src/components/DeliveryTimeline.jsx
