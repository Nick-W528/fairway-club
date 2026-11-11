-- Club branding and location (for the weather on the home screen).
alter table public.clubs
  add column brand_color text check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column latitude numeric(8, 5) check (latitude between -90 and 90),
  add column longitude numeric(8, 5) check (longitude between -180 and 180);

-- Demo club location (fictional club, real-world coordinates for the weather).
update public.clubs set latitude = 51.75, longitude = -1.26 where slug = 'oakridge';
