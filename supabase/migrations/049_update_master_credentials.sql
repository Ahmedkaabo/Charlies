-- ============================================================
-- 049_update_master_credentials.sql
-- Update master Owner email and password.
-- ============================================================

do $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'owner@charlies.com';

  -- Update auth user
  update auth.users
     set email              = 'ahmedkaaboo@gmail.com',
         encrypted_password = extensions.crypt('Medo123!''', extensions.gen_salt('bf')),
         updated_at         = now()
   where id = v_uid;

  -- Update identity record
  update auth.identities
     set provider_id    = 'ahmedkaaboo@gmail.com',
         identity_data  = jsonb_build_object('sub', v_uid::text, 'email', 'ahmedkaaboo@gmail.com'),
         updated_at     = now()
   where user_id = v_uid;

  -- Update profile email
  update public.profiles
     set email = 'ahmedkaaboo@gmail.com'
   where id = v_uid;

end;
$$;
