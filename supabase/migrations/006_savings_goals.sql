-- Tabla de metas de ahorro
CREATE TABLE IF NOT EXISTS savings_goals (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text           NOT NULL,
  target_amount  numeric(12,2)  NOT NULL,
  current_amount numeric(12,2)  NOT NULL DEFAULT 0,
  target_date    date,
  emoji          text           NOT NULL DEFAULT '🎯',
  is_completed   boolean        NOT NULL DEFAULT false,
  notes          text,
  created_at     timestamptz    NOT NULL DEFAULT now()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own goals"
  ON savings_goals FOR ALL
  USING (auth.uid() = user_id);
