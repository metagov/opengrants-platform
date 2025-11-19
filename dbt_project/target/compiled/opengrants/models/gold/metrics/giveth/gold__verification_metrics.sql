

SELECT
    'giveth' as platform,
    COUNT(*) AS total_projects,
    COUNT(CASE WHEN "io.giveth.verified" = true THEN 1 END) AS verified_projects,
    COUNT(CASE WHEN "io.giveth.verified" = false THEN 1 END) AS unverified_projects,
    ROUND(COUNT(CASE WHEN "io.giveth.verified" = true THEN 1 END) * 100.0 / COUNT(*), 2) AS verification_rate_pct
FROM "opengrants"."public"."silver_giveth_projects"