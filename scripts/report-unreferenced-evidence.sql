-- Read-only aggregate candidate list. This is not authorization to delete.
-- Ignore fresh in-flight uploads and objects outside the two evidence buckets.
select o.bucket_id, count(*) as unreferenced_candidates,
       coalesce(sum((o.metadata->>'size')::bigint),0) as candidate_bytes
from storage.objects o
where o.bucket_id in ('support-attachments','return-evidence')
  and o.created_at < now() - interval '1 day'
  and not exists (select 1 from public.support_tickets t
    where o.bucket_id='support-attachments' and o.name=any(t.attachment_paths))
  and not exists (select 1 from public.return_requests r
    where o.bucket_id='return-evidence' and o.name=any(r.evidence_paths))
group by o.bucket_id;
