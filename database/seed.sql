insert into public.departments (name, slug) values
  ('Roads and Stormwater', 'roads-and-stormwater'),
  ('Water and Sanitation', 'water-and-sanitation'),
  ('Electricity', 'electricity'),
  ('Waste Management', 'waste-management')
on conflict (slug) do nothing;

insert into public.categories (name, slug, description, default_urgency) values
  ('Pothole or road damage', 'pothole', 'Damage to a road surface that may affect vehicles or pedestrians.', 'medium'),
  ('Water leak', 'water_leak', 'Visible water loss from municipal or managed infrastructure.', 'high'),
  ('Electricity fault', 'electricity_fault', 'Power supply or electrical infrastructure problem.', 'high'),
  ('Broken streetlight', 'broken_streetlight', 'Streetlight that is not operating correctly.', 'medium'),
  ('Illegal dumping', 'illegal_dumping', 'Waste deposited outside an authorised disposal location.', 'medium'),
  ('Other infrastructure issue', 'other', 'An infrastructure issue not covered by an active category.', 'medium')
on conflict (slug) do nothing;

insert into public.department_categories (department_id, category_id)
select d.id, c.id
from public.departments d
join public.categories c on
  (d.slug = 'roads-and-stormwater' and c.slug = 'pothole') or
  (d.slug = 'water-and-sanitation' and c.slug = 'water_leak') or
  (d.slug = 'electricity' and c.slug in ('electricity_fault', 'broken_streetlight')) or
  (d.slug = 'waste-management' and c.slug = 'illegal_dumping')
on conflict do nothing;
