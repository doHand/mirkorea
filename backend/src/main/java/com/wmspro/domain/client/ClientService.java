package com.wmspro.domain.client;

import com.wmspro.common.PageResponse;
import com.wmspro.common.exception.BusinessException;
import com.wmspro.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClientService {

    private final ClientRepository repo;

    public PageResponse<Client> findAll(String search, int page, int limit) {
        String q = (search != null && !search.isBlank()) ? search : null;
        Page<Client> p = repo.search(q, PageRequest.of(page - 1, limit, Sort.by("name").ascending()));
        return new PageResponse<>(p, limit);
    }

    public List<Client> findAllActive() {
        return repo.findAll(Sort.by("name").ascending())
            .stream().filter(Client::isActive).toList();
    }

    public Client findById(UUID id) {
        return repo.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.CLIENT_NOT_FOUND));
    }

    @Transactional
    public Client create(ClientRequest req) {
        return repo.save(Client.builder()
            .name(req.name)
            .businessNo(req.businessNo)
            .address(req.address)
            .industry(req.industry)
            .sector(req.sector)
            .email(req.email)
            .phone(req.phone)
            .fax(req.fax)
            .customerType(req.customerType)
            .salesperson(req.salesperson)
            .mobile(req.mobile)
            .ceoName(req.ceoName)
            .postalCode(req.postalCode)
            .addressDetail(req.addressDetail)
            .contactName(req.contactName)
            .honorific(req.honorific)
            .managerName(req.managerName)
            .managerTitle(req.managerTitle)
            .website(req.website)
            .employeeCount(req.employeeCount)
            .pricePolicy(req.pricePolicy)
            .taxType(req.taxType)
            .discountRate(req.discountRate)
            .initialReceivable(req.initialReceivable)
            .unpaidOnly(Boolean.TRUE.equals(req.unpaidOnly))
            .registrationDate(req.registrationDate)
            .managementNo(req.managementNo)
            .memo(req.memo)
            .build());
    }

    @Transactional
    public Client update(UUID id, ClientRequest req) {
        Client c = findById(id);
        c.setName(req.name);
        c.setBusinessNo(req.businessNo);
        c.setAddress(req.address);
        c.setIndustry(req.industry);
        c.setSector(req.sector);
        c.setEmail(req.email);
        c.setPhone(req.phone);
        c.setFax(req.fax);
        c.setCustomerType(req.customerType);
        c.setSalesperson(req.salesperson);
        c.setMobile(req.mobile);
        c.setCeoName(req.ceoName);
        c.setPostalCode(req.postalCode);
        c.setAddressDetail(req.addressDetail);
        c.setContactName(req.contactName);
        c.setHonorific(req.honorific);
        c.setManagerName(req.managerName);
        c.setManagerTitle(req.managerTitle);
        c.setWebsite(req.website);
        c.setEmployeeCount(req.employeeCount);
        c.setPricePolicy(req.pricePolicy);
        c.setTaxType(req.taxType);
        c.setDiscountRate(req.discountRate);
        c.setInitialReceivable(req.initialReceivable);
        c.setUnpaidOnly(Boolean.TRUE.equals(req.unpaidOnly));
        c.setRegistrationDate(req.registrationDate);
        c.setManagementNo(req.managementNo);
        c.setMemo(req.memo);
        return repo.save(c);
    }

    @Transactional
    public void delete(UUID id) {
        Client client = findById(id);
        client.setActive(false);
        repo.save(client);
    }

    @Transactional
    public void restore(UUID id) {
        Client client = findById(id);
        client.setActive(true);
        repo.save(client);
    }
}
