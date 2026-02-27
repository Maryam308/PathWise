package com.pathwise.backend.controller;

import com.pathwise.backend.dto.LinkCardRequest;
import com.pathwise.backend.dto.PlaidLinkResponse;
import com.pathwise.backend.dto.TransactionResponse;
import com.pathwise.backend.service.PlaidService;
import com.pathwise.backend.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/plaid")
@RequiredArgsConstructor
public class PlaidController {

    private final PlaidService plaidService;
    private final TransactionService transactionService;

    //  Full Plaid Flow Endpoints 

    @PostMapping("/create-link-token")
    public ResponseEntity<PlaidLinkResponse> createLinkToken(@RequestBody Map<String, String> request) {
        String bankId = request.get("bankId"); // User selected "NBB", "BBK", etc. (for display only)
        String token = plaidService.createLinkToken();
        return ResponseEntity.ok(PlaidLinkResponse.builder().linkToken(token).build());
    }

    @PostMapping("/exchange-token")
    public ResponseEntity<String> exchangeToken(@RequestBody Map<String, Object> request) {
        String publicToken = (String) request.get("publicToken");
        String bankId = (String) request.get("bankId");
        String institutionName = (String) request.get("institutionName"); // From Plaid (ignored)
        
        plaidService.exchangeTokenAndSave(publicToken, bankId, institutionName);
        return ResponseEntity.ok("Bank account linked successfully!");
    }

    // Manual card linking endpoint 

    @PostMapping("/link-card")
    public ResponseEntity<String> linkCard(@Valid @RequestBody LinkCardRequest request) {
        plaidService.linkCard(request);
        return ResponseEntity.ok("Bank card linked successfully!");
    }

    // Sync transactions 

    @PostMapping("/sync")
    public ResponseEntity<String> syncTransactions() {
        plaidService.syncTransactions();
        return ResponseEntity.ok("Transactions synced successfully!");
    }

    // Get transactions with pagination 

    @GetMapping("/transactions")
    public ResponseEntity<Page<TransactionResponse>> getTransactions(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(
                transactionService.getTransactions(search, category, month, year, pageable));
    }
}