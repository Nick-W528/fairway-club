-- Demo data for local development. A fictional club with one course,
-- competitions, posts and pro shop items. Sign up in the app, join
-- "Oakridge Golf Club", then promote yourself (see README).

do $$
declare
  v_club uuid := '00000000-0000-0000-0000-00000000c1b1';
  v_course uuid := '00000000-0000-0000-0000-0000000c0a5e';
  v_pars int[] := array[4,4,3,5,4,4,3,4,5, 4,3,4,5,4,4,3,4,5];
  v_si int[] := array[7,3,15,11,1,9,17,5,13, 8,16,2,12,6,4,18,10,14];
  v_yards int[] := array[384,412,168,512,441,365,152,398,526, 377,181,428,498,402,389,143,371,541];
  i int;
begin
  insert into public.clubs (id, name, slug, tagline, address, phone, email, website)
  values (v_club, 'Oakridge Golf Club', 'oakridge', 'Parkland golf since 1921',
          '1 Fairway Lane, Oakridge', '01234 567890', 'office@oakridge.example', 'https://oakridge.example');

  insert into public.courses (id, club_id, name, description, par, yardage, course_rating, slope_rating, status, status_note)
  values (v_course, v_club, 'Championship Course',
          'Mature tree-lined parkland with fast, undulating greens and a closing stretch played around the lake.',
          72, 6888, 72.4, 131, 'open', 'Course open. Trolleys allowed, buggies restricted to paths.');

  for i in 1..18 loop
    insert into public.holes (course_id, number, par, stroke_index, yards_white, yards_yellow, yards_red)
    values (v_course, i, v_pars[i], v_si[i], v_yards[i], v_yards[i] - 20, v_yards[i] - 55);
  end loop;

  insert into public.posts (club_id, department, title, body, pinned, author_id) values
    (v_club, 'club', 'Welcome to the new members app', 'Book tee times, enter competitions and top up your bar card all in one place.', true, null),
    (v_club, 'greenkeeping', 'Hollow tining next week', 'Greens on holes 1-9 will be hollow tined on Monday and Tuesday. Temporary greens in play.', false, null),
    (v_club, 'bar', 'Sunday carvery is back', 'Carvery served 12:00-15:00 every Sunday. Book a table at the bar.', false, null),
    (v_club, 'pro_shop', 'Winter waterproofs in stock', 'New range of waterproof jackets and trousers now in the shop.', false, null),
    (v_club, 'golf_pro', 'Junior coaching sign-up', 'Saturday morning junior academy restarts this month. Ask in the shop.', false, null),
    (v_club, 'competitions', 'Monthly Medal entries open', 'Entries for this month''s medal are now open in the app.', false, null);

  insert into public.competitions (club_id, course_id, name, description, format, play_date, first_tee, last_tee, entry_fee_cents, max_entries, status)
  values
    (v_club, v_course, 'Monthly Medal', 'Strokeplay qualifier. Full handicap.', 'medal', current_date + 3, '08:00', '11:00', 500, 72, 'open'),
    (v_club, v_course, 'Seniors Stableford', 'Open to members aged 55+.', 'stableford', current_date + 6, '09:00', '10:30', 300, 40, 'open'),
    (v_club, v_course, 'Captain''s Day', 'The highlight of the year. Fancy dress optional.', 'stableford', current_date + 20, '07:30', '13:00', 1500, 120, 'draft');

  insert into public.products (club_id, name, description, category, price_cents, stock) values
    (v_club, 'Club logo polo', 'Breathable performance polo with embroidered crest.', 'Clothing', 3500, 24),
    (v_club, 'Tour balls (dozen)', 'Premium urethane tour ball.', 'Balls', 4999, 40),
    (v_club, 'Waterproof jacket', 'Fully seam-sealed, 2-year waterproof guarantee.', 'Clothing', 12000, 8),
    (v_club, 'Logo pitch-mark tool', 'Repair your pitch marks in style.', 'Accessories', 800, null),
    (v_club, '30-min lesson voucher', 'Lesson with the head professional.', 'Lessons', 3000, null);
end $$;
