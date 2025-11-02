{{ config(materialized='view') }}

SELECT * FROM {{ source('silver', 'silver_giveth_projects') }}
