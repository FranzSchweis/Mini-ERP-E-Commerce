-- Run this only against an existing mini_erp database.
-- Do not run the complete initialization SQL again.

SELECT `id`, `purchase_order_number`, `status`
FROM `inventory_purchaseorder`
WHERE `status` NOT IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled');

-- Apply only after the query above returns no rows.
ALTER TABLE `inventory_purchaseorder`
ADD CONSTRAINT `inventory_purchaseorder_status_valid`
CHECK (`status` IN (
    'draft',
    'ordered',
    'partially_received',
    'received',
    'cancelled'
));
