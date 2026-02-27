package com.pathwise.backend.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaidLinkRequest {
    private String publicToken;
    private String institutionName;
}