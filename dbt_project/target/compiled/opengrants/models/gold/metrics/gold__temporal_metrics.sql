

SELECT
    EXTRACT(YEAR FROM close_date::timestamp) AS year,
    EXTRACT(QUARTER FROM close_date::timestamp) AS quarter,
    COUNT(*) AS rounds_count,
    SUM(total_pool_size_usd) AS total_funding_usd
FROM "opengrants"."public"."gold__all_grant_pools"
WHERE close_date IS NOT NULL
GROUP BY year, quarter
ORDER BY year DESC, quarter DESC