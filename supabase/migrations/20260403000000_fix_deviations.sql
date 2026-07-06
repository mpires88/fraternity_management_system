-- Fix spec deviations

-- 1. Add missing logo_url to fraternities
alter table fraternities add column if not exists logo_url text;
