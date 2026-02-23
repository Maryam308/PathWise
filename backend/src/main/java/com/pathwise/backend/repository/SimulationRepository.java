package com.pathwise.backend.repository;

import com.pathwise.backend.model.Simulation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface SimulationRepository extends JpaRepository<Simulation, UUID> {
    List<Simulation> findByUserIdAndGoalId(UUID userId, UUID goalId);
}