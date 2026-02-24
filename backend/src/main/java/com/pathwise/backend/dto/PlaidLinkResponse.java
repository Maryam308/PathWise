package com.pathwise.backend.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaidLinkResponse {
    private String linkToken;
}