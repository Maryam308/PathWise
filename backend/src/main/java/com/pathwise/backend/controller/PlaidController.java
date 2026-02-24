package com.pathwise.backend.controller;

import com.pathwise.backend.dto.PlaidLinkRequest;
import com.pathwise.backend.dto.PlaidLinkResponse;
import com.pathwise.backend.dto.TransactionResponse;
import com.pathwise.backend.service.PlaidService;
import com.pathwise.backend.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/plaid")
@RequiredArgsConstructor
public class PlaidController {

    private final PlaidService plaidService;
    private final TransactionService transactionService;

    // Frontend calls this first to get link token → opens Plaid UI
    @GetMapping("/link-token")
    public ResponseEntity<PlaidLinkResponse> getLinkToken() {
        String token = plaidService.createLinkToken();
        return ResponseEntity.ok(PlaidLinkResponse.builder().linkToken(token).build());
    }

    // Frontend calls this after user completes Plaid flow
    @PostMapping("/exchange-token")
    public ResponseEntity<String> exchangeToken(@RequestBody PlaidLinkRequest request) {
        plaidService.exchangeTokenAndSave(
                request.getPublicToken(),
                request.getInstitutionName()
        );
        return ResponseEntity.ok("Bank account linked successfully!");
    }

    // Get all transactions for logged in user
    @GetMapping("/transactions")
    public ResponseEntity<List<TransactionResponse>> getTransactions() {
        return ResponseEntity.ok(transactionService.getUserTransactions());
    }
} 