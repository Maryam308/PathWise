package com.pathwise.backend.controller;

import com.pathwise.backend.dto.SimulationRequest;
import com.pathwise.backend.dto.SimulationResponse;
import com.pathwise.backend.service.SimulationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/goals")
@RequiredArgsConstructor
public class SimulationController {

    private final SimulationService simulationService;

    @PostMapping("/simulate")
    public ResponseEntity<SimulationResponse> simulate(
            @Valid @RequestBody SimulationRequest request) {
        return ResponseEntity.ok(simulationService.simulate(request));
    }

    @GetMapping("/{goalId}/simulations")
    public ResponseEntity<List<SimulationResponse>> getSavedSimulations(
            @PathVariable UUID goalId) {
        return ResponseEntity.ok(simulationService.getSavedSimulations(goalId));
    }
}
