
  
    

  create  table "opengrants"."public"."gold__all_projects__dbt_tmp"
  
  
    as
  
  (
    

-- Giveth Projects
SELECT 
    'giveth' as platform,
    id,
    name,
    description,
    "contentURI" as content_uri,
    "image" as image_url,
    "email" as contact_email,
    "io.giveth.verified" as is_verified,
    "io.giveth.totalDonations" as total_donations_usd,
    "io.giveth.countUniqueDonors" as unique_donors
FROM "opengrants"."public"."silver_giveth_projects"

UNION ALL

-- SCF Projects  
SELECT 
    'scf' as platform,
    id,
    name,
    description,
    "contentURI" as content_uri,
    "image" as image_url,
    "email" as contact_email,
    NULL as is_verified,
    "io.scf.totalAwardedUSD"::numeric as total_donations_usd,
    NULL as unique_donors
FROM "opengrants"."public"."silver_scf_projects"

UNION ALL

-- Privote Projects
SELECT 
    'privote' as platform,
    id,
    name,
    description,
    "contentURI" as content_uri,
    "image" as image_url,
    "email" as contact_email,
    "io.privote.initialized" as is_verified,
    NULL as total_donations_usd,
    NULL as unique_donors
FROM "opengrants"."public"."silver_privote_projects"
  );
  