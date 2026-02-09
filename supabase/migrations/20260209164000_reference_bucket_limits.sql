-- Enforce references bucket constraints at the database level.
-- Local CLI config alone may not backfill existing bucket metadata.
update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/m4a'
  ]::text[]
where id = 'references';
