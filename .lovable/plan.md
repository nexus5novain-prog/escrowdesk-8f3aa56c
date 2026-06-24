## Close out the 7 security findings

The fixes are already in place (migration `20260624030351_…sql` plus code updates). What's left is to formally close the findings and refresh the security memory so future scans don't re-flag the same items.

### Steps

1. Call `security--manage_security_finding` to mark each of these as resolved with a short note pointing at the migration / code change:
   - `SUPA_authenticated_security_definer_function_executable` — REVOKE EXECUTE from PUBLIC/anon/authenticated on all SECURITY DEFINER fns; re-granted only `has_role`, `is_staff`, `is_arbiter`, `is_group_member`, `get_my_private_profile`.
   - `SUPA_public_bucket_allows_listing` — dropped broad LIST policy on `avatars`; public URL fetch still works via CDN.
   - `ads_bucket_authenticated_read` — `ads` bucket restricted to staff (admin/moderator) only.
   - `escrow_groups_card_data_public` — dropped `card_number`, `cvv`, `expire_date`, `card_address` columns from `escrow_groups`; updated `escrow.functions.ts` and `transactions.tsx`.
   - `marketplace_products_anon_readable` — column-level grants: revoked default SELECT, granted only safe public columns to anon/authenticated.
   - `profiles_sensitive_fields_public` — same column-level grant pattern on `profiles`; sensitive fields read via `get_my_private_profile`.
   - `realtime_arbitration_messages_staff_only_leak` — addressed by the `escrow_groups` column drop + existing RLS; confirm scope.

2. Call `security--update_memory` to record the new posture so the scanner stops re-flagging:
   - BTC-only schema; no card PAN/CVV columns anywhere — flag any re-introduction.
   - All SECURITY DEFINER fns must `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`; only RLS helpers (`has_role`, `is_staff`, `is_arbiter`, `is_group_member`) + `get_my_private_profile` are executable.
   - `profiles` and `marketplace_products` use column-level grants — full-row SELECT to anon/authenticated is forbidden.
   - `ads` storage bucket is staff-only; `avatars` bucket has no LIST policy.
   - Remove any stale advice that no longer applies.

3. Reply to the user with a one-line confirmation.

No file edits or migrations in this step — fixes already shipped in the prior turn.
