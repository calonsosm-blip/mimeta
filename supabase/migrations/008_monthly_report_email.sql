-- Preferencia de reporte mensual por email (solo usuarios premium)
alter table profiles
  add column if not exists monthly_report_email boolean not null default false;
