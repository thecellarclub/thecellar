-- Tiers v3.1: Coravin moves from milestone 6 to milestone 7 (Palatine tier is
-- now earned at case 6 on its own, one case ahead of the Coravin milestone —
-- the two used to coincide, they no longer do). See
-- claude-code-prompt-tiers-v3-1.md §3.

do $$
begin
  if exists (select 1 from milestone_awards where milestone = 6) then
    raise exception 'milestone_seven: found existing milestone=6 rows — refusing to alter the check constraint blind. Resolve manually first.';
  end if;
end $$;

alter table milestone_awards drop constraint milestone_awards_milestone_check;
alter table milestone_awards add constraint milestone_awards_milestone_check check (milestone in (1, 3, 5, 7));
