-- Source audit and model matches: docs/product-measurement-sources.md
-- Only dimension fields are modified. Abort atomically if the catalog has changed.
DO $migration$
BEGIN
  UPDATE public.products SET dimensions = '[{"label":"Width","value":"90","unit":"cm"},{"label":"Length","value":"180","unit":"cm"},{"label":"Height","value":"75","unit":"cm"}]'
  WHERE id = 'alba' AND dimensions::jsonb = '[{"label":"Length","value":"90 x 180","unit":"cm"},{"label":"Height","value":"75","unit":"cm"}]'::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Measurement precondition failed: alba'; END IF;
  UPDATE public.products SET dimensions = '[{"label":"Diameter","value":"120","unit":"cm"},{"label":"Height","value":"76","unit":"cm"}]'
  WHERE id = 'albie' AND dimensions::jsonb = '[{"label":"Diameter","value":"120 x 76","unit":"cm"}]'::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Measurement precondition failed: albie'; END IF;
  UPDATE public.products SET dimensions = '[{"label":"Width","value":"100","unit":"cm"},{"label":"Length","value":"220","unit":"cm"},{"label":"Height","value":"75","unit":"cm"}]'
  WHERE id = 'eris-dining-room-marble-top-dining-table-0890866b' AND dimensions::jsonb = '[{"label":"Length","value":"100 x 220","unit":"cm"},{"label":"Height","value":"75","unit":"cm"}]'::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Measurement precondition failed: eris-dining-room-marble-top-dining-table-0890866b'; END IF;
  UPDATE public.products SET dimensions = '[{"label":"Width","value":"55.2","unit":"in"},{"label":"Depth","value":"9.25","unit":"in"},{"label":"Height","value":"11.81","unit":"in"}]'
  WHERE id = 'heavenly-youth-55' AND dimensions::jsonb = '[{"label":"Dimension","value":"9.25 x 55.2 x 11.81","unit":"in"}]'::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Measurement precondition failed: heavenly-youth-55'; END IF;
  UPDATE public.products SET dimensions = '[{"label":"Width","value":"145","unit":"cm"},{"label":"Depth","value":"71.5","unit":"cm"},{"label":"Height","value":"71.5","unit":"cm"}]'
  WHERE id = 'hemlingby-living-room-2-seater-fabric-sofa-6a262b18' AND dimensions::jsonb = '[{"label":"Width","value":"75","unit":"cm"},{"label":"Height","value":"82","unit":"cm"}]'::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Measurement precondition failed: hemlingby-living-room-2-seater-fabric-sofa-6a262b18'; END IF;
  UPDATE public.products SET dimensions = '[{"label":"Width","value":"156","unit":"cm"},{"label":"Length","value":"206","unit":"cm"},{"label":"Height","value":"66","unit":"cm"},{"label":"Mattress length","value":"200","unit":"cm"},{"label":"Mattress width","value":"150","unit":"cm"}]'
  WHERE id = 'vihals' AND dimensions::jsonb = '[{"label":"Mattress length","value":"200","unit":"cm"},{"label":"Mattress width","value":"150","unit":"cm"}]'::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Measurement precondition failed: vihals'; END IF;
  UPDATE public.products SET dimensions = '[{"label":"Back Cushions Height","value":"80 (31 1/2 \")","unit":"cm"},{"label":"Dept Chaise","value":"164 (64 5/8 \")","unit":"cm"},{"label":"Depth","value":"98 (38 5/8 \")","unit":"cm"},{"label":"Chaise Lounge Seat Depth","value":"125 (49 1/4 \")","unit":"cm"},{"label":"Seat Width Right","value":"192 (75 5/8 \")","unit":"cm"},{"label":"Seat Width Left","value":"273 (107 1/2 \")","unit":"cm"},{"label":"Height Under Furniture","value":"4 (1 5/8 \")","unit":"cm"},{"label":"Armrest Width","value":"15 (5 7/8 \")","unit":"cm"},{"label":"Armrest Height","value":"65 (25 5/8 \")","unit":"cm"},{"label":"Seat Depth","value":"55 cm (21 5/8 \")","unit":"cm"},{"label":"Seat Height","value":"45 (17 3/4 \")","unit":"cm"},{"label":"Width left","value":"330","unit":"cm"},{"label":"Width right","value":"249","unit":"cm"}]'
  WHERE id = 'vimle' AND dimensions::jsonb = '[{"label":"Back Cushions Height","value":"80 (31 1/2 \")","unit":"cm"},{"label":"Dept Chaise","value":"164 (64 5/8 \")","unit":"cm"},{"label":"Depth","value":"98 (38 5/8 \")","unit":"cm"},{"label":"Chaise Lounge Seat Depth","value":"125 (49 1/4 \")","unit":"cm"},{"label":"Seat Width Right","value":"192 (75 5/8 \")","unit":"cm"},{"label":"Seat Width Left","value":"273 (107 1/2 \")","unit":"cm"},{"label":"Height Under Furniture","value":"4 (1 5/8 \")","unit":"cm"},{"label":"Armrest Width","value":"15 (5 7/8 \")","unit":"cm"},{"label":"Armrest Height","value":"65 (25 5/8 \")","unit":"cm"},{"label":"Seat Depth","value":"55 cm (21 5/8 \")","unit":"cm"},{"label":"Seat Height","value":"45 (17 3/4 \")","unit":"cm"}]'::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Measurement precondition failed: vimle'; END IF;
END
$migration$;
