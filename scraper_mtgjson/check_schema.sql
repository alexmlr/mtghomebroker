
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name IN ('user_tracked_cards', 'all_cards') 
ORDER BY 
    table_name, column_name;
