

SELECT
    source,
    CASE 
        WHEN "io.giveth.totalProjectUpdates" = 0 THEN 'No Updates'
        WHEN "io.giveth.totalProjectUpdates" <= 3 THEN 'Low Engagement'
        WHEN "io.giveth.totalProjectUpdates" <= 10 THEN 'Medium Engagement'
        ELSE 'High Engagement'
    END AS engagement_tier,
    COUNT(*) AS project_count,
    AVG("io.giveth.totalDonations") AS avg_donations,
    AVG("io.giveth.countUniqueDonors") AS avg_donors,
    AVG("io.giveth.qualityScore") AS avg_quality_score
FROM "opengrants"."public"."gold__all_projects"
GROUP BY 1, 2
ORDER BY avg_donations DESC