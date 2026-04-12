# SCHEMA DO BANCO - RAREGROOVE
# Referência para todas as tabelas e colunas

## transactions
Colunas reais no banco:
- id (uuid, PK)
- item_id (uuid, FK items)
- buyer_id (uuid, FK auth.users)
- seller_id (uuid, FK auth.users)  
- status (text): 'pendente' | 'pago' | 'enviado' | 'concluido' | 'cancelado' | 'pago_em_custodia' | 'waiting_approval'
- price (decimal)
- created_at (timestamp)
- updated_at (timestamp)

 Colunas adcionais (migrações):
- transaction_type (text): 'venda' | 'venda_portal' | 'troca'
- platform_fee (decimal)
- gateway_fee (decimal)
- total_amount (decimal)
- net_amount (decimal)
- shipping_cost (decimal)
- insurance_cost (decimal)
- payment_id (text)
- payment_method (text)
- external_reference (text)
- shipping_id (uuid, FK shipping)

## items
- id (uuid, PK)
- seller_id (uuid, FK auth.users)
- title (text)
- cover_url (text)
- price (decimal)
- is_sold (boolean)
- status (text): 'disponivel' | 'reservado' | 'vendido'
- sold_to_id (uuid)
- sold_date (timestamp)

## profiles
- id (uuid, PK, FK auth.users)
- full_name (text)
- avatar_url (text)
- address (text)
- number (text)
- complement (text)
- city (text)
- state (text)
- cep (text)
- pix_key (text)
- pix_beneficiary (text)
- pix_enabled (boolean)

## shipping
- id (uuid, PK)
- transaction_id (uuid, FK transactions)
- buyer_id (uuid, FK auth.users)
- seller_id (uuid, FK auth.users)
- item_id (uuid, FK items)
- from_cep (text)
- from_address (jsonb)
- to_cep (text)
- to_address (jsonb)
- estimated_cost (decimal)
- carrier (text): 'correios'
- status (text): 'awaiting_label' | 'label_generated' | 'in_transit' | 'delivered'
- tracking_code (text)

## platform_settings (tabela admin)
- pix_enabled (boolean)
- pix_key (text)
- pix_beneficiary (text)
- processing_fee_fixed (decimal)
- sale_fee_pct (decimal)