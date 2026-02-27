package com.pathwise.backend.scheduler;

import com.pathwise.backend.model.User;
import com.pathwise.backend.repository.AccountRepository;
import com.pathwise.backend.repository.UserRepository;
import com.pathwise.backend.service.ReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class MonthlyReportScheduler {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final ReportService reportService;

    private static final int BATCH_SIZE = 5;
    private static final long DELAY_BETWEEN_BATCHES_MS = 5 * 60 * 1000; // 5 minutes

    // Runs at 8:00 AM on the 1st of every month
    @Scheduled(cron = "0 0 8 1 * *")
    public void generateMonthlyReportsForAllUsers() {
        log.info("⏰ Monthly report generation started...");

        // Only users with a linked account
        List<User> eligibleUsers = userRepository.findAll().stream()
                .filter(u -> accountRepository.findByUserId(u.getId()).isPresent())
                .toList();

        log.info("Found {} eligible users. Processing in batches of {} with {}min delay between batches.",
                eligibleUsers.size(), BATCH_SIZE, DELAY_BETWEEN_BATCHES_MS / 60000);

        int totalSuccess = 0;
        int totalFailed = 0;

        // Split into batches
        for (int i = 0; i < eligibleUsers.size(); i += BATCH_SIZE) {
            int batchEnd = Math.min(i + BATCH_SIZE, eligibleUsers.size());
            List<User> batch = eligibleUsers.subList(i, batchEnd);
            int batchNumber = (i / BATCH_SIZE) + 1;
            int totalBatches = (int) Math.ceil((double) eligibleUsers.size() / BATCH_SIZE);

            log.info("Processing batch {}/{} ({} users)...", batchNumber, totalBatches, batch.size());

            // Process each user in the batch
            for (User user : batch) {
                try {
                    reportService.generateReportForUser(user);
                    totalSuccess++;
                    log.info("✅ Report generated for: {}", user.getEmail());
                } catch (Exception e) {
                    totalFailed++;
                    log.error("❌ Report failed for {}: {}", user.getEmail(), e.getMessage());
                }
            }

            // Wait 5 minutes before next batch (skip wait after last batch)
            boolean isLastBatch = batchEnd >= eligibleUsers.size();
            if (!isLastBatch) {
                log.info("Batch {}/{} done. Waiting 5 minutes before next batch...", batchNumber, totalBatches);
                try {
                    Thread.sleep(DELAY_BETWEEN_BATCHES_MS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.warn("Scheduler interrupted during wait. Stopping report generation.");
                    break;
                }
            }
        }

        log.info("✅ Monthly reports complete. Success: {}, Failed: {}", totalSuccess, totalFailed);
    }
}