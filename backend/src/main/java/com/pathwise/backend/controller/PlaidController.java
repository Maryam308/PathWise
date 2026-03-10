package com.pathwise.backend.controller;

import com.pathwise.backend.dto.AccountResponse;
import com.pathwise.backend.dto.LinkCardRequest;
import com.pathwise.backend.dto.PlaidLinkResponse;
import com.pathwise.backend.dto.TransactionResponse;
import com.pathwise.backend.model.Account;
import com.pathwise.backend.service.PlaidService;
import com.pathwise.backend.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/plaid")
@RequiredArgsConstructor
public class PlaidController {

    private final PlaidService plaidService;
    private final TransactionService transactionService;

    @PostMapping("/create-link-token")
    public ResponseEntity<PlaidLinkResponse> createLinkToken(@RequestBody Map<String, String> request) {
        String bankId = request.get("bankId");
        String token = plaidService.createLinkToken();
        return ResponseEntity.ok(PlaidLinkResponse.builder().linkToken(token).build());
    }

    @PostMapping("/exchange-token")
    public ResponseEntity<String> exchangeToken(@RequestBody Map<String, Object> request) {
        String publicToken = (String) request.get("publicToken");
        String bankId = (String) request.get("bankId");
        String institutionName = (String) request.get("institutionName");
        
        plaidService.exchangeTokenAndSave(publicToken, bankId, institutionName);
        return ResponseEntity.ok("Bank account linked successfully!");
    }

    @PostMapping("/link-card")
    public ResponseEntity<String> linkCard(@Valid @RequestBody LinkCardRequest request) {
        plaidService.linkCard(request);
        return ResponseEntity.ok("Bank card linked successfully!");
    }

    @GetMapping("/transactions")
    public ResponseEntity<Page<TransactionResponse>> getTransactions(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDir,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "8") int size) {

        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(
                transactionService.getTransactions(search, category, type, month, year, sortBy, sortDir, pageable));
    }

    @GetMapping("/accounts")
    public ResponseEntity<List<AccountResponse>> getAccounts() {
        List<Account> accounts = plaidService.getCurrentUserAccounts();
        List<AccountResponse> responses = accounts.stream()
                .map(this::mapToAccountResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responses);
    }

    private AccountResponse mapToAccountResponse(Account account) {
        return AccountResponse.builder()
                .id(account.getId())
                .bankName(account.getBankName())
                .cardType(account.getCardType() != null ? account.getCardType().name() : null)
                .cardHolderName(account.getCardHolderName())
                .maskedNumber(account.getMaskedNumber())
                .expiryMonth(account.getExpiryMonth())
                .expiryYear(account.getExpiryYear())
                .balance(account.getBalance())
                .currency(account.getCurrency())
                .build();
    }
}