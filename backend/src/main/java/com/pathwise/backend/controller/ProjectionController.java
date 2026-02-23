package com.pathwise.backend.controller;

import com.pathwise.backend.dto.ProjectionRequest;
import com.pathwise.backend.dto.ProjectionResponse;
import com.pathwise.backend.service.ProjectionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class ProjectionController {

    private final ProjectionService projectionService;

    @PostMapping("/{id}/projection")
    public ResponseEntity<ProjectionResponse> getProjection(
            @PathVariable UUID id,
            @Valid @RequestBody ProjectionRequest request) {
        return ResponseEntity.ok(
                projectionService.getProjection(id, request.getMonthlySavingsRate())
        );
    }
}