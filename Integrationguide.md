How to Integrate a New Data Source (End-to-End)                                                                                              
                                                                                                                                               
  Phase 1 — Raw Data (Bronze)
                                                                                                                                               
  1. Drop raw files                                                                                                                            
  - Place CSVs in raw_data/<Source>/<date>/                                                                                                    
  - Document column names, data types, known quirks (large JSON blobs, encoding issues)                                                        
                                                                                                                                             
  2. Create bronze Dagster asset (og_dagster/assets/bronze/<source>.py)                                                                        
  - Define CSV_TABLE_MAP — one entry per file: (filename, table_name, is_large)                                                                
  - Use psycopg2 COPY FROM STDIN pattern (not polars write_database)                                                                           
  - Set csv.field_size_limit(sys.maxsize) if any fields contain large JSON                                                                     
  - Mark files >50MB as stream_large=True                                                                                                      
  - Register the job in definitions.py                                                                                                         
                                                                                                                                               
  3. Validate bronze load                                                                                                                      
  - Run bronze_<source>_job in Dagster                                                                                                         
  - Spot-check row counts: SELECT COUNT(*) FROM bronze_<source>_<table>                                                                        
  - Verify no truncated rows, encoding errors, or missing columns                                                                              
                                                                                                                                               
  ---                                                                                                                                          
  Phase 2 — Schema Map                                                                                                                         
                                                                                                                                               
  4. Create DAOIP-5 schema map (og_dagster/configs/schema_maps/active/daoip5_<source>.yaml)                                                    
  - Follow daoip5_giveth.yaml structure                                                                                                        
  - Map core DAOIP-5 fields: id, name, description, contentURI, etc.                                                                           
  - Put vendor-specific fields under extensions: <namespace>.:                                                                                 
    - Valid prefixes: io., org., com., co., x-, ethereum., stellar.                                                                            
  - Write transform: lambdas for JSON parsing, ID prefixing, enum normalization                                                                
                                                                                                                                               
  5. Validate schema map                                                                                                                       
  python3 -c "                                                                                                                                 
  import yamale                                                                                                                                
  yamale.validate(                                                                                                                           
    yamale.make_schema('og_dagster/configs/schema_maps/schema_manifest.yaml'),
    yamale.make_data('og_dagster/configs/schema_maps/active/daoip5_<source>.yaml')                                                             
  )                                                                                                                                            
  print('PASS')                                                                                                                                
  "                                                                                                                                            
  - Fix any type mismatches or missing required: fields until PASS                                                                             
   
  ---                                                                                                                                          
  Phase 3 — Silver (DAOIP-5 normalized)                                                                                                      
                                       
  6. Create silver Dagster assets (og_dagster/assets/silver/<source>/<source>.py)
  - One @asset per DAOIP-5 table (grant_pools, projects, grant_applications, donations, payouts, attestations as applicable)                   
  - Each calls build_silver(engine, schema_path, section) then write_database()                                                                
  - Add SQL enrichment functions for any data that lives in bronze reference tables                                                            
  - Register assets + job in definitions.py                                                                                                    
                                                                                                                                               
  7. Update dbt_project/models/sources.yml                                                                                                     
  - Add all new silver_<source>_* table names under the silver source                                                                          
                                                                                                                                               
  8. Materialize silver tables                                                                                                                 
  - Run silver_<source>_etl_job in Dagster                                                                                                     
  - Verify: SELECT COUNT(*), COUNT(id) FROM silver_<source>_grant_pools                                                                        
  - Check extension columns populated: SELECT "co.<ns>.someField" FROM silver_<source>_... LIMIT 5
                                                                                                                                               
  ---                                                                                                                                          
  Phase 4 — Gold (dbt analytics)                                                                                                               
                                                                                                                                               
  9. Add to cross-platform base models                                                                                                       
  - gold__all_projects.sql — add UNION ALL with platform-specific extension columns
  - gold__all_grant_pools.sql — add UNION ALL                                      
  - gold__all_grant_applications.sql — add UNION ALL
  - gold__ecosystem_overview.sql — add platform row                                                                                            
  - gold__cross_platform.sql — add to all_projects CTE + add <source>_funding column
  - gold__new_vs_repeat_funded.sql — add to combined CTE                                                                                       
  - gold_temporal_funding.sql — add rounds to timeline                                                                                         
                                                                                                                                               
  10. Create platform-specific dashboard models (dashboards/<source>/)                                                                         
  - gold__<source>_rounds.sql — per-round stats                                                                                                
  - gold__<source>_projects.sql — projects with aggregated funding                                                                           
  - Any domain-specific models (donations summary, attestations, etc.)                                                                         
                                                                                                                                             
  11. Run dbt                                                                                                                                  
  dbt run --select gold                                                                                                                        
  dbt test --select gold                                                                                                                       
  - Fix any compilation errors (missing sources, bad column refs)                                                                              
                                                                                                                                             
  ---                                                                                                                                          
  Phase 5 — Frontend
                                                                                                                                               
  12. Create API endpoint (src/app/api/system/<source>/route.ts)                                                                             
  - Query the gold tables via the DB pool                                                                                                      
  - Return JSON shaped for the dashboard page                                                                                                  
                                                                                                                                               
  13. Build the page (src/app/system/<source>/page.tsx)                                                                                        
  - Fetch from the API endpoint                                                                                                                
  - Display: ecosystem overview cards, rounds table, top projects, funding charts
                                                                                                                                               
  14. QA                                                                                                                                       
  - Run /qa on the page                                                                                                                        
  - Verify numbers match raw CSV row counts                                                                                                    
  - Check null handling, edge cases in transforms                                                                                              
                                                                                                                                               
  ---                                                                                                                                          
  Quick Checklist                                                                                                                              
                                                                                                                                               
  [ ] raw CSVs placed in raw_data/                                                                                                           
  [ ] bronze asset + job created                                                                                                               
  [ ] bronze job runs clean (correct row counts)
  [ ] daoip5_<source>.yaml created                                                                                                             
  [ ] yamale PASS on schema map                                                                                                                
  [ ] silver assets created                                                                                                                    
  [ ] silver job materializes all tables                                                                                                       
  [ ] sources.yml updated                                                                                                                      
  [ ] base gold UNIONs updated (5 files)
  [ ] platform-specific gold models created                                                                                                    
  [ ] dbt run --select gold passes                                                                                                           
  [ ] dbt test --select gold passes                                                                                                            
  [ ] API route created                                                                                                                      
  [ ] Frontend page created and displays data                                                                                                  
  [ ] QA pass


It should follow this workflow cycle
/plan-eng-review
→
Implement
→
/review
→
/ship
→
/qa