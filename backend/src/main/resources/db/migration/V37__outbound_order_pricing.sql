-- 출고 주문 아이템에 단가 추가
ALTER TABLE outbound_order_items
  ADD COLUMN unit_price BIGINT NOT NULL DEFAULT 0;

-- 출고 주문에 할인율 추가
ALTER TABLE outbound_orders
  ADD COLUMN discount_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
