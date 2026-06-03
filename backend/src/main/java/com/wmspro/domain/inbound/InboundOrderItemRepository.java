package com.wmspro.domain.inbound;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface InboundOrderItemRepository extends JpaRepository<InboundOrderItem, UUID> {
}
