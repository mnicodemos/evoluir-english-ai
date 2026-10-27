-- Keep the six restored Vimeo videos on the lesson records consumed by Summary.
-- This migration deliberately does not depend on the separate lesson_videos admin table.
-- Idempotent: re-running it sets the same URLs on matching lesson records.

UPDATE public.lessons
SET
  video_url = CASE curriculum_key
    WHEN 'b1-u2-l2' THEN 'https://vimeo.com/1239699995'
    WHEN 'b2-u1-l1' THEN 'https://vimeo.com/1239966935'
    WHEN 'b1-u1-l3' THEN 'https://vimeo.com/1239888973'
    WHEN 'b1-u1-l6' THEN 'https://vimeo.com/1239865994'
    WHEN 'a1-u1-l3' THEN 'https://vimeo.com/1239904982'
    WHEN 'biz-u1-l1' THEN 'https://vimeo.com/1239925702'
    ELSE video_url
  END
WHERE curriculum_key IN (
  'b1-u2-l2',
  'b2-u1-l1',
  'b1-u1-l3',
  'b1-u1-l6',
  'a1-u1-l3',
  'biz-u1-l1'
);
