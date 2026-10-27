-- Clean up old/duplicate Klook widgets
-- Keep only the official 6 categories

DELETE FROM klook_widgets 
WHERE name NOT IN (
  'Attractions & shows',
  'Tours & sightseeing', 
  'Food & dining',
  'Transport & WiFi',
  'Activities & experiences',
  'Attraction passes'
);

