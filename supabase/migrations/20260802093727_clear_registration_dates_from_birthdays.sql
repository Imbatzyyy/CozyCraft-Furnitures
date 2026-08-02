-- An earlier profile flow could copy the account creation calendar date into
-- date_of_birth. A birthday is optional and must only be supplied by the user.
update public.profiles as profile
set date_of_birth = null
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.date_of_birth is not null
  and profile.date_of_birth = (auth_user.created_at at time zone 'Asia/Manila')::date;
