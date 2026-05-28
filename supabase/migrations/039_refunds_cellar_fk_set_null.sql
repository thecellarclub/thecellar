-- Change refunds.cellar_id FK to ON DELETE SET NULL
-- so that cellar rows can be deleted after a refund without violating the constraint.
ALTER TABLE refunds DROP CONSTRAINT refunds_cellar_id_fkey;
ALTER TABLE refunds ADD CONSTRAINT refunds_cellar_id_fkey
  FOREIGN KEY (cellar_id) REFERENCES cellar(id) ON DELETE SET NULL;
